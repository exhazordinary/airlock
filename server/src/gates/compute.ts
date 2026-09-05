import type { Span } from "./redact.js";

export type Op = "add" | "subtract" | "multiply" | "divide" | "sum";

export interface Step {
  id: string;
  op: Op;
  args: string[];
}

export interface ComputationPlan {
  answer_template: string;
  steps: Step[];
  result: string;
  cited_spans: string[];
}

export type RefusalCode =
  | "NOT_IN_DOCUMENT"
  | "INVALID_PLAN"
  | "UNKNOWN_SOURCE"
  | "REDACTED_SOURCE"
  | "MISSING_CITATION"
  | "DISALLOWED_CONSTANT"
  | "UNSAFE_MATH"
  | "TOO_COMPLEX";

export interface Operand {
  ref: string;
  kind: "span" | "step" | "const";
  label?: string;
  text: string;
  value: number;
}

export interface TraceStep {
  id: string;
  op: Op;
  operands: Operand[];
  value: number;
  expression: string;
}

export interface Source {
  id: string;
  label?: string;
  text: string;
  value: number;
}

export type Verdict =
  | {
      status: "VERIFIED";
      value: number;
      answer: string;
      cited: string[];
      trace: TraceStep[];
      sources: Source[];
    }
  | { status: "CANNOT_VERIFY"; reason: string; code: RefusalCode };

const OPS: readonly Op[] = ["add", "subtract", "multiply", "divide", "sum"];

// Unit conversion and counting only. Nothing that could stand in for a figure.
const CONSTANTS: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "4": 4, "12": 12, "100": 100, "365": 365,
};

const SYMBOL: Record<Op, string> = {
  add: "+", subtract: "-", multiply: "×", divide: "÷", sum: "+",
};

const CONST_PREFIX = "const:";
const MAX_STEPS = 12;
const PLACEHOLDER = "{{v}}";
const STEP_ID = /^t\d{1,3}$/;
const ANSWER_TEMPLATES = [
  "The verified result is {{v}}.",
  "The verified amount is {{v}}.",
  "The verified percentage is {{v}}%.",
  "The verified count is {{v}}.",
] as const;

// A flat list of uniform objects. No numeric type appears anywhere, so a model
// generating within this grammar cannot express a figure of its own.
export const COMPUTATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer_template: {
      type: "STRING",
      enum: [...ANSWER_TEMPLATES],
      description: "a server-approved sentence for the verified value",
    },
    steps: {
      type: "ARRAY",
      description: "calculation steps in order; each may use spans or earlier step ids",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "t1, t2, t3 ... in order" },
          op: { type: "STRING", enum: [...OPS] },
          args: {
            type: "ARRAY",
            description: `span ids, ids of earlier steps, or ${CONST_PREFIX}N where N is one of ${Object.keys(CONSTANTS).join(", ")}`,
            items: { type: "STRING" },
          },
        },
        required: ["id", "op", "args"],
      },
    },
    result: { type: "STRING", description: "the step id or span id holding the answer" },
    cited_spans: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["answer_template", "steps", "result", "cited_spans"],
} as const;

class Refusal extends Error {
  constructor(reason: string, readonly code: RefusalCode) {
    super(reason);
  }
}

// The explicit const annotation is what lets TypeScript treat a refuse() call as
// terminating, so the code after it narrows.
const refuse: (reason: string, code: RefusalCode) => never = (reason, code) => {
  throw new Refusal(reason, code);
};

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
};

const format = (v: number): string =>
  Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function apply(op: Op, values: number[]): number {
  switch (op) {
    case "add": return values[0]! + values[1]!;
    case "subtract": return values[0]! - values[1]!;
    case "multiply": return values[0]! * values[1]!;
    case "divide":
      if (values[1] === 0) refuse("The computation divides by zero.", "UNSAFE_MATH");
      return values[0]! / values[1]!;
    case "sum": return values.reduce((a, b) => a + b, 0);
  }
}

export function evaluatePlan(plan: ComputationPlan, spans: Span[]): Verdict {
  try {
    // The model's way of saying the document cannot answer this. Checked first, so a
    // genuine refusal reads as plain English rather than a schema complaint. We show a
    // fixed sentence rather than its prose, so no unverified figure reaches the user.
    if (Array.isArray(plan?.steps) && plan.steps.length === 0 && !plan.result) {
      refuse("The document does not contain what is needed to answer this.", "NOT_IN_DOCUMENT");
    }

    if (
      typeof plan?.answer_template !== "string" ||
      !ANSWER_TEMPLATES.includes(plan.answer_template as (typeof ANSWER_TEMPLATES)[number])
    ) {
      refuse("The answer template is not allowed.", "INVALID_PLAN");
    }

    const steps = plan.steps ?? [];
    if (!Array.isArray(steps)) refuse("The steps are malformed.", "INVALID_PLAN");

    if (steps.length > MAX_STEPS) {
      refuse("The computation has too many steps.", "TOO_COMPLEX");
    }

    const facts = new Map(spans.map((s) => [s.id, s]));
    const used = new Set<string>();
    const computed = new Map<string, number>();
    const trace: TraceStep[] = [];

    const fromSpan = (id: string): Operand => {
      const span = facts.get(id);
      if (!span) refuse("The computation refers to an unknown source.", "UNKNOWN_SOURCE");
      if (span.redacted || span.value === null || span.value === undefined) {
        refuse("The computation cites a redacted source.", "REDACTED_SOURCE");
      }
      used.add(id);
      const value = span.value as number;
      return { ref: id, kind: "span", label: span.rowLabel, text: span.text, value };
    };

    for (const step of steps) {
      if (!step || typeof step.id !== "string" || !STEP_ID.test(step.id)) {
        refuse("The computation contains a malformed step.", "INVALID_PLAN");
      }
      if (computed.has(step.id)) {
        refuse("The computation contains a duplicate step identifier.", "INVALID_PLAN");
      }
      if (!OPS.includes(step.op)) {
        refuse("The computation contains an unsupported operation.", "INVALID_PLAN");
      }
      if (!Array.isArray(step.args)) {
        refuse("The computation contains a malformed step.", "INVALID_PLAN");
      }

      const binary = step.op !== "sum";
      if (binary && step.args.length !== 2) {
        refuse("Wrong arity for the selected operation.", "INVALID_PLAN");
      }
      if (!binary && step.args.length < 1) {
        refuse("Wrong arity for the selected operation.", "INVALID_PLAN");
      }

      const operands: Operand[] = step.args.map((arg) => {
        if (typeof arg !== "string") {
          refuse("The computation contains a malformed argument.", "INVALID_PLAN");
        }
        if (arg.startsWith(CONST_PREFIX)) {
          const c = CONSTANTS[arg.slice(CONST_PREFIX.length)];
          if (c === undefined) {
            refuse("The computation uses a constant that is not allowed.", "DISALLOWED_CONSTANT");
          }
          return { ref: arg, kind: "const", text: format(c), value: c };
        }
        // Only steps already computed resolve, so a forward reference cannot.
        if (computed.has(arg)) {
          const value = computed.get(arg)!;
          return { ref: arg, kind: "step", label: `step ${arg}`, text: format(value), value };
        }
        return fromSpan(arg);
      });

      const value = clean(apply(step.op, operands.map((o) => o.value)));
      computed.set(step.id, value);
      trace.push({
        id: step.id,
        op: step.op,
        operands,
        value,
        expression: `${operands.map((o) => o.text).join(` ${SYMBOL[step.op]} `)} = ${format(value)}`,
      });
    }

    const target = plan.result;
    const raw = computed.has(target)
      ? computed.get(target)!
      : facts.has(target)
        ? fromSpan(target).value
        : refuse("The result does not name a known step or source.", "UNKNOWN_SOURCE");

    if (!Number.isFinite(raw)) {
      refuse("The computation did not produce a finite value.", "UNSAFE_MATH");
    }

    if (
      !Array.isArray(plan.cited_spans) ||
      !plan.cited_spans.every((id) => typeof id === "string")
    ) {
      refuse("The cited sources are malformed.", "INVALID_PLAN");
    }
    const cited = new Set(plan.cited_spans ?? []);
    for (const id of used) {
      if (!cited.has(id)) {
        refuse("A source used by the computation is missing from cited_spans.", "MISSING_CITATION");
      }
    }

    const value = clean(raw);
    return {
      status: "VERIFIED",
      value,
      answer: plan.answer_template.split(PLACEHOLDER).join(format(value)),
      cited: [...used],
      trace,
      sources: [...used].map((id) => {
        const span = facts.get(id)!;
        return { id, label: span.rowLabel, text: span.text, value: span.value as number };
      }),
    };
  } catch (err) {
    if (err instanceof Refusal) {
      return { status: "CANNOT_VERIFY", reason: err.message, code: err.code };
    }
    throw err;
  }
}

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

export type Verdict =
  | { status: "VERIFIED"; value: number; answer: string; cited: string[] }
  | { status: "CANNOT_VERIFY"; reason: string };

const OPS: readonly Op[] = ["add", "subtract", "multiply", "divide", "sum"];

// Unit conversion and counting only. Nothing that could stand in for a figure.
const CONSTANTS: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "4": 4, "12": 12, "100": 100, "365": 365,
};

const CONST_PREFIX = "const:";
const MAX_STEPS = 12;
const PLACEHOLDER = "{{v}}";
const STEP_ID = /^t\d{1,3}$/;

// A flat list of uniform objects. No numeric type appears anywhere, so a model
// generating within this grammar cannot express a figure of its own.
export const COMPUTATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer_template: {
      type: "STRING",
      description: `the sentence to show, containing ${PLACEHOLDER} where the value belongs`,
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

class Refusal extends Error {}

// The explicit const annotation is what lets TypeScript treat a refuse() call as
// terminating, so the code after it narrows.
const refuse: (reason: string) => never = (reason) => {
  throw new Refusal(reason);
};

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
};

const format = (v: number): string =>
  Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function spanValue(id: string, facts: Map<string, Span>, used: Set<string>): number {
  const span = facts.get(id);
  if (!span) refuse(`The computation refers to an unknown value "${id}".`);
  if (span.redacted || span.value === null || span.value === undefined) {
    refuse(`The computation cites a redacted span "${id}".`);
  }
  used.add(id);
  return span.value as number;
}

function apply(op: Op, values: number[]): number {
  switch (op) {
    case "add": return values[0]! + values[1]!;
    case "subtract": return values[0]! - values[1]!;
    case "multiply": return values[0]! * values[1]!;
    case "divide":
      if (values[1] === 0) refuse("The computation divides by zero.");
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
      refuse("The document does not contain what is needed to answer this.");
    }

    if (!plan?.answer_template?.includes(PLACEHOLDER)) {
      refuse(`The answer template has no ${PLACEHOLDER} placeholder.`);
    }

    const steps = plan.steps ?? [];
    if (!Array.isArray(steps)) refuse("The steps are malformed.");

    if (steps.length > MAX_STEPS) {
      refuse(`Too many steps (${steps.length}); the limit is ${MAX_STEPS}.`);
    }

    const facts = new Map(spans.map((s) => [s.id, s]));
    const used = new Set<string>();
    const computed = new Map<string, number>();

    for (const step of steps) {
      if (!step || typeof step.id !== "string" || !STEP_ID.test(step.id)) {
        refuse("The computation contains a malformed step.");
      }
      if (computed.has(step.id)) refuse(`Duplicate step id "${step.id}".`);
      if (!OPS.includes(step.op)) refuse(`"${String(step.op)}" is not a supported operation.`);
      if (!Array.isArray(step.args)) refuse("The computation contains a malformed step.");

      const binary = step.op !== "sum";
      if (binary && step.args.length !== 2) {
        refuse(`Wrong arity: "${step.op}" takes 2 arguments, got ${step.args.length}.`);
      }
      if (!binary && step.args.length < 1) {
        refuse(`Wrong arity: "sum" needs at least 1 argument.`);
      }

      const values = step.args.map((arg) => {
        if (typeof arg !== "string") refuse("The computation contains a malformed argument.");
        if (arg.startsWith(CONST_PREFIX)) {
          const c = CONSTANTS[arg.slice(CONST_PREFIX.length)];
          if (c === undefined) refuse(`"${arg}" is not an allowed constant.`);
          return c;
        }
        // Only steps already computed resolve, so a forward reference cannot.
        if (computed.has(arg)) return computed.get(arg)!;
        return spanValue(arg, facts, used);
      });

      computed.set(step.id, apply(step.op, values));
    }

    const target = plan.result;
    const raw = computed.has(target)
      ? computed.get(target)!
      : facts.has(target)
        ? spanValue(target, facts, used)
        : refuse(`The result "${String(target)}" does not name a known step or span.`);

    if (!Number.isFinite(raw)) refuse("The computation did not produce a finite value.");

    const cited = new Set(plan.cited_spans ?? []);
    for (const id of used) {
      if (!cited.has(id)) refuse(`The computation used span "${id}" but it is not in cited_spans.`);
    }

    const value = clean(raw);
    return {
      status: "VERIFIED",
      value,
      answer: plan.answer_template.split(PLACEHOLDER).join(format(value)),
      cited: [...used],
    };
  } catch (err) {
    if (err instanceof Refusal) return { status: "CANNOT_VERIFY", reason: err.message };
    throw err;
  }
}

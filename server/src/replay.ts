import type { Span } from "./gates/redact.js";
import type { ComputationPlan, Op } from "./gates/compute.js";

const ROW_PREFIX = "@";

interface RecordedStep {
  id: string;
  op: Op;
  args: string[];
}

interface Recording {
  intent: RegExp;
  answer_template: string;
  steps: RecordedStep[];
  result: string;
}

/**
 * Plans captured from real Gemini runs, addressed by row label rather than span id so
 * a recording survives an edited document. Replay substitutes only the model; Gate 1
 * and Gate 2 still run live, so an altered figure is recomputed, never repeated.
 */
const RECORDINGS: Recording[] = [
  {
    intent: /deduct|withheld|taken\s+out/i,
    answer_template: "The verified amount is {{v}}.",
    steps: [{ id: "t1", op: "sum", args: ["@epf employee", "@socso", "@pcb tax"] }],
    result: "t1",
  },
  {
    intent: /\bpercent(age)?\b|\b%\b/i,
    answer_template: "The verified percentage is {{v}}%.",
    steps: [
      { id: "t1", op: "divide", args: ["@epf employee", "@gross pay"] },
      { id: "t2", op: "multiply", args: ["t1", "const:100"] },
    ],
    result: "t2",
  },
  {
    intent: /net\s*pay|take[-\s]?home/i,
    answer_template: "The verified amount is {{v}}.",
    steps: [],
    result: "@net pay",
  },
  {
    intent: /\bgross\b/i,
    answer_template: "The verified amount is {{v}}.",
    steps: [],
    result: "@gross pay",
  },
  {
    intent: /\b(basic|overtime)\b/i,
    answer_template: "The verified amount is {{v}}.",
    steps: [{ id: "t1", op: "add", args: ["@basic salary", "@overtime"] }],
    result: "t1",
  },
  {
    intent: /\b(amount\s+due|balance\s+due|invoice\s+total|total\s+due)\b/i,
    answer_template: "The verified amount is {{v}}.",
    steps: [],
    result: "@amount due",
  },
  {
    intent: /\b(subtotal|before\s+tax|line\s+items?)\b/i,
    answer_template: "The verified amount is {{v}}.",
    steps: [{ id: "t1", op: "subtract", args: ["@amount due", "@sst 8%"] }],
    result: "t1",
  },
];

const rowIndex = (spans: Span[]): Map<string, string> => {
  const index = new Map<string, string>();
  for (const span of spans) {
    if (span.redacted || span.value === null || span.value === undefined) continue;
    const label = span.rowLabel?.trim().toLowerCase();
    if (label && !index.has(label)) index.set(label, span.id);
  }
  return index;
};

/** Returns a plan bound to this document's span ids, or null if it cannot be. */
export function replayPlan(question: string, spans: Span[]): ComputationPlan | null {
  const recording = RECORDINGS.find((r) => r.intent.test(question));
  if (!recording) return null;

  const rows = rowIndex(spans);
  const cited = new Set<string>();

  const bind = (ref: string): string | null => {
    if (!ref.startsWith(ROW_PREFIX)) return ref;
    const id = rows.get(ref.slice(ROW_PREFIX.length));
    if (!id) return null;
    cited.add(id);
    return id;
  };

  const steps = [];
  for (const step of recording.steps) {
    const args = [];
    for (const arg of step.args) {
      const bound = bind(arg);
      if (bound === null) return null;
      args.push(bound);
    }
    steps.push({ id: step.id, op: step.op, args });
  }

  const result = bind(recording.result);
  if (result === null) return null;

  return {
    answer_template: recording.answer_template,
    steps,
    result,
    cited_spans: [...cited],
  };
}

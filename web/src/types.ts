export type Verdict = "VERIFIED" | "CANNOT_VERIFY";

export interface Operand {
  ref: string;
  kind: "span" | "step" | "const";
  label?: string;
  text: string;
  value: number;
}

export interface TraceStep {
  id: string;
  op: "add" | "subtract" | "multiply" | "divide" | "sum";
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

export interface PublicSpan {
  id: string;
  text: string;
  value: number | null;
  label: string | null;
  isTotal: boolean;
  redacted: boolean;
  redactionType: string | null;
}

export interface AskResponse {
  receiptId: string;
  question: string;
  verdict: Verdict;
  answer?: string;
  reason?: string;
  code?: string;
  value?: number;
  citedSpans?: string[];
  trace?: TraceStep[];
  sources?: Source[];
  spans: PublicSpan[];
  redactions: Record<string, number>;
  modelSaw: string;
  model: string | null;
  replayed: boolean;
  injectionFlagged: boolean;
  latencyMs: number;
  quota: { used: number; limit: number };
}

export interface ReceiptRow extends Partial<AskResponse> {
  id: string;
  question?: string;
  createdAt?: { seconds: number };
}

export const MAX_DOCUMENT_CHARS = 20_000;
export const MAX_QUESTION_CHARS = 500;

export interface AskInput {
  document: string;
  question: string;
  mode: "live" | "replay";
}

export type Validation =
  | { ok: true; input: AskInput }
  | { ok: false; error: string };

const text = (value: unknown, field: string, max: number): string | { error: string } => {
  if (typeof value !== "string") return { error: `${field} must be text.` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required.` };
  if (value.length > max) {
    return { error: `${field} must be ${max.toLocaleString("en-US")} characters or fewer.` };
  }
  return trimmed;
};

/** Rejects at the edge so nothing oversized or mistyped reaches a gate or a bill. */
export function validateAsk(body: unknown): Validation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const raw = body as Record<string, unknown>;

  const document = text(raw.document, "Document", MAX_DOCUMENT_CHARS);
  if (typeof document !== "string") return { ok: false, error: document.error };

  const question = text(raw.question, "Question", MAX_QUESTION_CHARS);
  if (typeof question !== "string") return { ok: false, error: question.error };

  const mode = raw.mode ?? "live";
  if (mode !== "live" && mode !== "replay") {
    return { ok: false, error: "Mode must be either live or replay." };
  }

  return { ok: true, input: { document, question, mode } };
}

export type RedactionKind = "NRIC" | "PHONE" | "ACCT" | "EMAIL" | "ADDR" | "NAME";

export interface Span {
  id: string;
  text: string;
  value?: number | null;
  colLabel?: string;
  rowLabel?: string;
  isTotal?: boolean;
  redacted?: boolean;
  redactionType?: RedactionKind;
}

// The birth-date component is what makes this safe; a bare 12-digit rule also
// matches account numbers and invoice ids.
const NRIC = /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-\d{2}-\d{4}(?!\d)/g;
const PHONE = /(?<!\d)(?:\+?60|0)\s?(?:1\d[-\s]?\d{3,4}[-\s]?\d{4}|3[-\s]?\d{4}[-\s]?\d{4}|[4-79][-\s]?\d{3}[-\s]?\d{4}|8\d[-\s]?\d{3}[-\s]?\d{3})(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const ACCOUNT_CONTEXT = /(\b(?:bank\s+)?(?:account|acct|a\/c)[\s_]*(?:no\.?|num(?:ber)?|#)\s*[:=#-]?\s*)(\d(?:[\s-]?\d){7,17})(?!\d)/gi;

const PATTERN_RULES: ReadonlyArray<readonly [RedactionKind, RegExp]> = [
  ["EMAIL", EMAIL],
  ["NRIC", NRIC],
  ["PHONE", PHONE],
];

const LABEL_LEAK_RULES: ReadonlyArray<readonly [RedactionKind, RegExp]> = [
  ["NRIC", /\b(?:nric|ic\s*no|identity\s*card)\s*(?:=|:)\s*(?!\[NRIC_\d+\])\S/i],
  ["ACCT", /\b(?:bank\s+)?(?:account|acct|a\/c)[\s_]*(?:no\.?|num(?:ber)?|#)\s*(?:=|:)\s*(?!\[ACCT_\d+\])\S/i],
  ["PHONE", /\b(?:phone|mobile|tel(?:ephone)?)\s*(?:=|:)\s*(?!\[PHONE_\d+\])\S/i],
  ["ADDR", /\b(?:address|postcode|poskod)\s*(?:=|:)\s*(?!\[ADDR_\d+\])\S/i],
  ["NAME", /\b(?:name|prepared\s*by|preparer|contact)\s*(?:=|:)\s*(?!\[NAME_\d+\])\S/i],
];

// CAUTION: the account rule must demand an explicit number-word. Matching bare
// "account" masks row labels like "Total per audited accounts" — silently turning
// a verifiable figure into a redacted one.
const LABEL_RULES: ReadonlyArray<readonly [RedactionKind, RegExp]> = [
  ["NRIC", /\bnric\b|\bic\s*no|identity\s*card/i],
  ["ACCT", /\b(?:bank\s+)?account[\s_]*(?:no\.?|num(?:ber)?|#)|\bacct[\s_]*(?:no\.?|num(?:ber)?|#)|\ba\/c[\s_]*(?:no\.?|num(?:ber)?|#)/i],
  ["PHONE", /phone|mobile|tel(?:ephone)?\b/i],
  ["ADDR", /address|postcode|poskod/i],
  ["NAME", /\bname\b|prepared\s*by|preparer|contact/i],
];

const looksNumeric = (text: string): boolean => /^[\d,.\s()%-]+$/.test(text.trim());

export class Redactor {
  #tokens = new Map<string, string>();
  #counts = new Map<RedactionKind, number>();

  get ledger(): Partial<Record<RedactionKind, number>> {
    return Object.fromEntries(this.#counts);
  }

  #mint(kind: RedactionKind, original: string): string {
    const key = `${kind}:${original}`;
    const existing = this.#tokens.get(key);
    if (existing) return existing;

    const next = (this.#counts.get(kind) ?? 0) + 1;
    this.#counts.set(kind, next);
    const token = `[${kind}_${next}]`;
    this.#tokens.set(key, token);
    return token;
  }

  mask(text: string): string {
    let out = text;
    for (const [kind, rule] of PATTERN_RULES) {
      out = out.replace(new RegExp(rule.source, rule.flags), (m) => this.#mint(kind, m));
    }
    out = out.replace(
      new RegExp(ACCOUNT_CONTEXT.source, ACCOUNT_CONTEXT.flags),
      (_match, label: string, value: string) => `${label}${this.#mint("ACCT", value)}`,
    );
    return out;
  }

  #labelKind(span: Span): RedactionKind | null {
    for (const field of [span.colLabel, span.rowLabel]) {
      if (!field) continue;
      for (const [kind, rule] of LABEL_RULES) {
        if (rule.test(field)) return kind;
      }
    }
    return null;
  }

  redactSpans(spans: Span[]): Span[] {
    for (const span of spans) {
      const text = (span.text ?? "").trim();
      if (!text) continue;

      let kind: RedactionKind | null = null;
      for (const [candidate, rule] of PATTERN_RULES) {
        if (new RegExp(rule.source, rule.flags).test(text)) {
          kind = candidate;
          break;
        }
      }

      if (!kind && new RegExp(ACCOUNT_CONTEXT.source, ACCOUNT_CONTEXT.flags).test(text)) {
        kind = "ACCT";
      }

      if (!kind && !span.isTotal) {
        const labelled = this.#labelKind(span);
        if (labelled && !(labelled === "NAME" && looksNumeric(text))) kind = labelled;
      }

      if (!kind) continue;

      span.text = this.#mint(kind, text);
      span.value = null;
      span.redacted = true;
      span.redactionType = kind;
    }
    return spans;
  }
}

/** Last line of defence, called immediately before bytes leave the process. */
export function assertClean(payload: string): void {
  for (const [kind, rule] of PATTERN_RULES) {
    const hit = new RegExp(rule.source, rule.flags).exec(payload);
    if (hit) {
      throw new Error(
        `AIRLOCK: refusing to send. Unmasked ${kind} found at offset ${hit.index}.`,
      );
    }
  }

  for (const [kind, rule] of LABEL_LEAK_RULES) {
    const hit = new RegExp(rule.source, rule.flags).exec(payload);
    if (!hit) continue;
    throw new Error(
      `AIRLOCK: refusing to send. Unmasked ${kind} found at offset ${hit.index}.`,
    );
  }
}

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
const PHONE = /(?<!\d)(?:\+?60|0)1\d[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const ACCT = /(?<!\d)\d{12}(?!\d)/g;

const PATTERN_RULES: ReadonlyArray<readonly [RedactionKind, RegExp]> = [
  ["EMAIL", EMAIL],
  ["NRIC", NRIC],
  ["PHONE", PHONE],
  ["ACCT", ACCT],
];

// A 12-digit figure is legitimate in financial prose, so ACCT is not a leak signal.
const LEAK_RULES = PATTERN_RULES.filter(([kind]) => kind !== "ACCT");

// CAUTION: the account rule must demand an explicit number-word. Matching bare
// "account" masks row labels like "Total per audited accounts" — silently turning
// a verifiable figure into a redacted one.
const LABEL_RULES: ReadonlyArray<readonly [RedactionKind, RegExp]> = [
  ["NRIC", /\bnric\b|\bic\s*no|identity\s*card/i],
  ["ACCT", /\baccount[\s_]*(?:no\.?|num(?:ber)?|#)|\bacct[\s_]*(?:no|num|#)?\b|\ba\/c\b/i],
  ["PHONE", /phone|mobile|tel(?:ephone)?\b/i],
  ["ADDR", /address|postcode|poskod/i],
  ["NAME", /\bname\b|prepared\s*by|preparer|contact/i],
];

const looksNumeric = (text: string): boolean => /^[\d,.\s()%-]+$/.test(text.trim());

export class Redactor {
  #tokens = new Map<string, string>();
  #originals = new Map<string, string>();
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
    this.#originals.set(token, original);
    return token;
  }

  mask(text: string): string {
    let out = text;
    for (const [kind, rule] of PATTERN_RULES) {
      out = out.replace(new RegExp(rule.source, rule.flags), (m) => this.#mint(kind, m));
    }
    return out;
  }

  unmask(text: string): string {
    let out = text;
    for (const [token, original] of this.#originals) {
      out = out.split(token).join(original);
    }
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

      // A computed total is never personal data, and masking one breaks verification.
      if (span.isTotal) continue;

      let kind: RedactionKind | null = null;
      for (const [candidate, rule] of PATTERN_RULES) {
        if (new RegExp(rule.source, rule.flags).test(text)) {
          kind = candidate;
          break;
        }
      }

      if (!kind) {
        const labelled = this.#labelKind(span);
        // A header like "Account Balance" must never mask money.
        if (labelled && !(labelled !== "ACCT" && looksNumeric(text))) kind = labelled;
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
  for (const [kind, rule] of LEAK_RULES) {
    const hit = new RegExp(rule.source, rule.flags).exec(payload);
    if (hit) {
      throw new Error(
        `AIRLOCK: refusing to send. Unmasked ${kind} found at offset ${hit.index}.`,
      );
    }
  }
}

import type { Span } from "./gates/redact.js";

const TOTAL_LABEL = /\b(total|net|nett|subtotal|balance|gross)\b/i;
const NUMERIC_VALUE = /^\s*(?:RM|MYR|\$)?\s*(\()?\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(\))?\s*%?\s*$/i;

function parseNumber(text: string): number | null {
  const match = text.match(NUMERIC_VALUE);
  if (!match) return null;

  const opens = Boolean(match[1]);
  const closes = Boolean(match[3]);
  if (opens !== closes || (opens && match[2]!.startsWith("-"))) return null;

  const n = Number(match[2]!.replaceAll(",", ""));
  if (!Number.isFinite(n)) return null;
  return opens ? -n : n;
}

/** Splits pasted document text into labelled spans the gates can reason over. */
export function extractSpans(text: string): Span[] {
  const spans: Span[] = [];
  let n = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const pair = line.match(/^(.{1,60}?)\s*[:\t]\s*(.+)$/);
    const rowLabel = pair ? pair[1]!.trim() : undefined;
    const body = pair ? pair[2]!.trim() : line;

    spans.push({
      id: `s${++n}`,
      text: body,
      value: parseNumber(body),
      rowLabel,
      isTotal: rowLabel ? TOTAL_LABEL.test(rowLabel) : false,
    });
  }
  return spans;
}

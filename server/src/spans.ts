import type { Span } from "./gates/redact.js";

const TOTAL_LABEL = /\b(total|net|nett|subtotal|balance|gross)\b/i;

function parseNumber(text: string): number | null {
  const negative = /^\(.*\)$/.test(text.trim());
  const cleaned = text.replace(/[()]/g, "").replace(/[^0-9.-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
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

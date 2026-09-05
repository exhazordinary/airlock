import type { AskResponse, TraceStep } from "../types";
import { formatValue } from "../format";

export const TRACE_SYMBOL: Record<TraceStep["op"], string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  sum: "+",
};

export const receiptProvenance = (result: AskResponse): string =>
  result.model ?? (result.replayed ? "demo plan" : "no AI call");

export const receiptAsText = (result: AskResponse): string => {
  const lines = [
    "AIRLOCK RECEIPT",
    `receipt   ${result.receiptId}`,
    `verdict   ${result.verdict}`,
    `source    ${receiptProvenance(result)}`,
    `latency   ${result.latencyMs} ms`,
    "",
    `question  ${result.question ?? ""}`.trimEnd(),
    "",
    "GATE 1 — masked before any model call",
    ...Object.entries(result.redactions).map(([type, count]) => `  ${type} x${count}`),
    ...(Object.keys(result.redactions).length ? [] : ["  nothing sensitive found"]),
    "",
  ];

  if (result.verdict !== "VERIFIED") {
    lines.push(
      "GATE 2 — refused",
      `  ${result.code ?? "CANNOT_VERIFY"}`,
      `  ${result.reason ?? ""}`,
      "",
      "ANSWER    none. No figure was produced.",
    );
    return lines.join("\n");
  }

  lines.push("GATE 2 — recomputed from your document");
  for (const step of result.trace ?? []) {
    lines.push(`  ${step.id}  ${step.op}`);
    step.operands.forEach((operand, index) => {
      const symbol = index === 0 ? " " : TRACE_SYMBOL[step.op];
      lines.push(`      ${symbol} ${(operand.label ?? operand.ref).padEnd(22)}${operand.text}`);
    });
    lines.push(`      = ${step.id.padEnd(22)}${formatValue(step.value)}`);
  }

  lines.push("", "CITED ROWS");
  for (const source of result.sources ?? []) {
    lines.push(`  ${source.id.padEnd(6)}${(source.label ?? "unlabelled").padEnd(22)}${source.text}`);
  }
  lines.push("", `ANSWER    ${result.answer}`);
  return lines.join("\n");
};

import { useState } from "react";
import type { AskResponse, PublicSpan, TraceStep } from "../types";
import { formatValue } from "../format";

const SYMBOL: Record<TraceStep["op"], string> = {
  add: "+", subtract: "−", multiply: "×", divide: "÷", sum: "+",
};

const REFUSAL_TITLE: Record<string, string> = {
  INJECTION_BLOCKED: "Inner door held shut",
  NOT_IN_DOCUMENT: "Not in this document",
  NO_RECORDING: "No recording for this question",
  PROVIDER_UNAVAILABLE: "No verifiable plan",
  UNKNOWN_SOURCE: "Cited a row that does not exist",
  REDACTED_SOURCE: "Cited a redacted row",
  MISSING_CITATION: "Used a row it did not cite",
  DISALLOWED_CONSTANT: "Used a number of its own",
  UNSAFE_MATH: "Arithmetic could not be trusted",
  INVALID_PLAN: "Plan did not fit the grammar",
  TOO_COMPLEX: "Plan exceeded the step ceiling",
};

const provenance = (r: AskResponse): string =>
  r.model ?? (r.replayed ? "recorded plan" : "no model call");

/** A plain-text receipt, so the proof survives leaving the page. */
function asText(r: AskResponse): string {
  const lines = [
    "AIRLOCK RECEIPT",
    `receipt   ${r.receiptId}`,
    `verdict   ${r.verdict}`,
    `source    ${provenance(r)}`,
    `latency   ${r.latencyMs} ms`,
    "",
    `question  ${r.question ?? ""}`.trimEnd(),
    "",
    "GATE 1 — masked before any model call",
    ...Object.entries(r.redactions).map(([k, v]) => `  ${k} x${v}`),
    ...(Object.keys(r.redactions).length ? [] : ["  nothing sensitive found"]),
    "",
  ];

  if (r.verdict === "VERIFIED") {
    lines.push("GATE 2 — recomputed from your document");
    for (const step of r.trace ?? []) {
      lines.push(`  ${step.id}  ${step.op}`);
      step.operands.forEach((o, i) =>
        lines.push(`      ${i === 0 ? " " : SYMBOL[step.op]} ${(o.label ?? o.ref).padEnd(22)}${o.text}`),
      );
      lines.push(`      = ${step.id.padEnd(22)}${formatValue(step.value)}`);
    }
    lines.push("", "CITED ROWS");
    for (const s of r.sources ?? []) {
      lines.push(`  ${s.id.padEnd(6)}${(s.label ?? "unlabelled").padEnd(22)}${s.text}`);
    }
    lines.push("", `ANSWER    ${r.answer}`);
  } else {
    lines.push("GATE 2 — refused", `  ${r.code ?? "CANNOT_VERIFY"}`, `  ${r.reason ?? ""}`);
    lines.push("", "ANSWER    none. No figure was produced.");
  }

  return lines.join("\n");
}

function Working({ trace }: { trace: TraceStep[] }) {
  return (
    <ol className="working">
      {trace.map((step) => (
        <li key={step.id} className="step">
          <div className="step-head">
            <span className="tag">{step.id}</span>
            <span className="op">{step.op}</span>
          </div>
          <table className="tally">
            <tbody>
              {step.operands.map((o, i) => (
                <tr key={`${o.ref}-${i}`}>
                  <td className="sign">{i === 0 ? "" : SYMBOL[step.op]}</td>
                  <td className="name">
                    {o.label ?? o.ref}
                    {o.kind !== "span" && <span className={`origin ${o.kind}`}>{o.kind}</span>}
                  </td>
                  <td className="num">{o.text}</td>
                </tr>
              ))}
              <tr className="total">
                <td className="sign">=</td>
                <td className="name">{step.id}</td>
                <td className="num">{formatValue(step.value)}</td>
              </tr>
            </tbody>
          </table>
        </li>
      ))}
    </ol>
  );
}

function SpanTable({ spans, cited }: { spans: PublicSpan[]; cited: Set<string> }) {
  return (
    <table className="spans">
      <caption className="sr-only">Every row of your document as the model received it</caption>
      <thead>
        <tr>
          <th scope="col">id</th>
          <th scope="col">row</th>
          <th scope="col">value the model received</th>
        </tr>
      </thead>
      <tbody>
        {spans.map((s) => (
          <tr
            key={s.id}
            className={`${s.redacted ? "masked" : ""} ${cited.has(s.id) ? "cited" : ""}`.trim()}
          >
            <td className="tag">{s.id}</td>
            <td className="name">{s.label ?? <em>unlabelled</em>}</td>
            <td className="num">
              {s.redacted ? (
                <span className="lock" title={`${s.redactionType} masked by Gate 1`}>
                  🔒 {s.text}
                </span>
              ) : (
                s.text
              )}
              {cited.has(s.id) && <span className="used">cited</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Receipt({
  result,
  stale,
}: {
  result: AskResponse;
  stale: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const verified = result.verdict === "VERIFIED";
  const cited = new Set(result.citedSpans ?? []);
  const maskedTotal = Object.values(result.redactions).reduce((a, b) => a + b, 0);
  const maskedRows = result.spans.filter((s) => s.redacted).length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={`receipt-card ${verified ? "ok" : "no"}${stale ? " stale" : ""}`}>
      {stale && (
        <p className="stale-note" role="status">
          The document or question has changed. This receipt belongs to the previous
          input — ask again to get one for what is on screen now.
        </p>
      )}

      <header className="verdict">
        <span className={`seal ${verified ? "ok" : "no"}`}>
          {verified ? "VERIFIED" : "CANNOT VERIFY"}
        </span>
        <div className="verdict-body">
          {verified ? (
            <>
              <p className="figure">{formatValue(result.value)}</p>
              <p className="answer">{result.answer}</p>
            </>
          ) : (
            <>
              <p className="refusal-title">{REFUSAL_TITLE[result.code ?? ""] ?? "Not verified"}</p>
              <p className="reason">{result.reason}</p>
              <p className="no-figure">No figure was produced. AIRLOCK does not guess.</p>
            </>
          )}
        </div>
      </header>

      <div className="badges">
        <span className="badge ok">
          {maskedTotal === 0 ? "nothing sensitive found" : `${maskedTotal} masked by Gate 1`}
        </span>
        {Object.entries(result.redactions).map(([k, v]) => (
          <span key={k} className="chip">{k} × {v}</span>
        ))}
        {result.injectionFlagged && <span className="badge flag">⚑ injection logged</span>}
        {result.replayed && <span className="badge warn">recorded plan · gates ran live</span>}
      </div>

      {verified && result.trace?.length ? (
        <section className="block">
          <h3>The working</h3>
          <Working trace={result.trace} />
        </section>
      ) : null}

      {verified && result.sources?.length ? (
        <section className="block">
          <h3>Cited from your document</h3>
          <ul className="sources">
            {result.sources.map((s) => (
              <li key={s.id}>
                <span className="tag">{s.id}</span>
                <span className="name">{s.label ?? "unlabelled row"}</span>
                <span className="num">{s.text}</span>
              </li>
            ))}
          </ul>
          {!result.trace?.length && (
            <p className="hint">Read straight off the document. No arithmetic was needed.</p>
          )}
        </section>
      ) : null}

      <section className="block">
        <button className="disclose" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"} Every row exactly as the model received it
          {" — "}{result.spans.length} rows, {maskedRows} masked
        </button>
        {open && (
          <>
            <SpanTable spans={result.spans} cited={cited} />
            <button
              className="disclose"
              aria-expanded={showPrompt}
              onClick={() => setShowPrompt(!showPrompt)}
            >
              {showPrompt ? "▾" : "▸"} The exact bytes sent to the model
            </button>
            {showPrompt && <pre>{result.modelSaw}</pre>}
          </>
        )}
      </section>

      <footer className="receipt-foot">
        <span className="chip" title="Server-written receipt id">#{result.receiptId.slice(0, 10)}</span>
        <span className="chip">{result.latencyMs} ms</span>
        <span className="chip">{provenance(result)}</span>
        <span className="chip">{result.quota.used}/{result.quota.limit} today</span>
        <button className="copy" onClick={copy}>
          {copied ? "Copied" : "Copy receipt"}
        </button>
      </footer>
    </article>
  );
}

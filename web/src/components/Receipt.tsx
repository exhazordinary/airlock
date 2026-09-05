import { useState } from "react";
import type { AskResponse } from "../types";
import { formatValue } from "../format";
import ReceiptDisclosure from "./ReceiptDisclosure";
import ReceiptProof from "./ReceiptProof";
import { receiptAsText, receiptProvenance } from "./receiptText";

const REFUSAL_TITLE: Record<string, string> = {
  INJECTION_BLOCKED: "Inner door held shut",
  NOT_IN_DOCUMENT: "Not in this document",
  NO_RECORDING: "No demo plan for this question",
  PROVIDER_UNAVAILABLE: "No verifiable plan",
  UNKNOWN_SOURCE: "A cited line does not exist",
  REDACTED_SOURCE: "A protected line cannot be used",
  MISSING_CITATION: "A used line was not cited",
  DISALLOWED_CONSTANT: "The plan introduced its own number",
  UNSAFE_MATH: "The calculation could not be trusted",
  INVALID_PLAN: "The plan did not fit the safe format",
  TOO_COMPLEX: "The plan exceeded the step limit",
};

export default function Receipt({
  result,
  stale,
  onLocateSource,
}: {
  result: AskResponse;
  stale: boolean;
  onLocateSource?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const verified = result.verdict === "VERIFIED";
  const protectedTotal = Object.values(result.redactions).reduce(
    (total, count) => total + count,
    0,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptAsText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={`receipt-card ${verified ? "ok" : "no"}${stale ? " stale" : ""}`}>
      {stale && (
        <p className="stale-note" role="status">
          This proof belongs to your previous document or question. Check again to
          create a receipt for what is on screen now.
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
          {protectedTotal === 0
            ? "No personal details found"
            : `${protectedTotal} personal details protected`}
        </span>
        {Object.entries(result.redactions).map(([type, count]) => (
          <span key={type} className="chip">{type} × {count}</span>
        ))}
        {result.injectionFlagged && <span className="badge flag">⚑ Unsafe instruction logged</span>}
        {result.replayed && <span className="badge warn">Demo plan · safety checks ran live</span>}
      </div>

      {verified && (
        <ReceiptProof trace={result.trace ?? []} sources={result.sources ?? []} onLocateSource={stale ? undefined : onLocateSource} />
      )}
      <ReceiptDisclosure
        spans={result.spans}
        citedSpans={result.citedSpans ?? []}
        modelSaw={result.modelSaw}
      />

      <footer className="receipt-foot">
        <span className="chip" title="Server-written receipt id">#{result.receiptId.slice(0, 10)}</span>
        <span className="chip">{result.latencyMs} ms</span>
        <span className="chip">{receiptProvenance(result)}</span>
        <span className="chip">{result.quota.used}/{result.quota.limit} today</span>
        <button className="copy" type="button" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy receipt"}
        </button>
      </footer>
    </article>
  );
}

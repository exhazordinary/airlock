import { useState } from "react";
import type { ReceiptRow } from "../types";
import { formatValue } from "../format";

const when = (row: ReceiptRow): string =>
  row.createdAt?.seconds
    ? new Date(row.createdAt.seconds * 1000).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({ row }: { row: ReceiptRow }) {
  const [open, setOpen] = useState(false);
  const verified = row.verdict === "VERIFIED";

  return (
    <li className={`ledger-row ${verified ? "ok" : "no"}`}>
      <button className="ledger-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`dot ${verified ? "ok" : "no"}`} aria-hidden="true" />
        <span className="sr-only">{verified ? "Verified" : "Not verified"}</span>
        <span className="q">{row.question ?? "—"}</span>
        {row.injectionFlagged && <span className="flagmark" title="Prompt injection logged">⚑</span>}
        <span className="num">{verified ? formatValue(row.value) : "—"}</span>
        <span className="chip">{when(row)}</span>
        <span className="caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="ledger-body">
          <dl>
            <div><dt>Verdict</dt><dd>{row.verdict ?? "—"}</dd></div>
            <div><dt>Reason</dt><dd>{row.reason ?? row.answer ?? "—"}</dd></div>
            <div><dt>Model</dt><dd>{row.model ?? (row.replayed ? "recorded plan" : "no model call")}</dd></div>
            <div><dt>Latency</dt><dd>{row.latencyMs ?? 0} ms</dd></div>
            <div>
              <dt>Masked</dt>
              <dd>
                {Object.entries(row.redactions ?? {}).map(([k, v]) => `${k}×${v}`).join("  ") || "none"}
              </dd>
            </div>
            <div><dt>Receipt</dt><dd className="mono">{row.id}</dd></div>
          </dl>
          {row.trace?.length ? (
            <ul className="mini-trace">
              {row.trace.map((t) => <li key={t.id}>{t.expression}</li>)}
            </ul>
          ) : null}
        </div>
      )}
    </li>
  );
}

export default function Ledger({
  rows,
  error,
}: {
  rows: ReceiptRow[];
  error: string;
}) {
  return (
    <section className="panel ledger">
      <div className="section-heading">
        <div>
          <h2>Previous checks</h2>
          <p>Your private, server-written receipt history.</p>
        </div>
        <span className="server-badge">Cannot be forged in the browser</span>
      </div>

      {error ? (
        <p className="err" role="alert">
          Previous checks could not load. Refresh the page to try again. {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="muted">
          No receipts yet. Your first completed check will appear here automatically.
        </p>
      ) : (
        <ul className="ledger-list">
          {rows.map((r) => <Row key={r.id} row={r} />)}
        </ul>
      )}

      <p className="muted foot-note">
        Only AIRLOCK's server can write these receipts. You can review your own history,
        but nobody can edit it from this browser.
      </p>
    </section>
  );
}

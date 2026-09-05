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
      <h2>Trust ledger — your receipts</h2>

      {error ? (
        <p className="err" role="alert">
          Could not load your receipts: {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="muted">
          No receipts yet. Every answer you ask for is recorded here, server-side.
        </p>
      ) : (
        <ul className="ledger-list">
          {rows.map((r) => <Row key={r.id} row={r} />)}
        </ul>
      )}

      <p className="muted foot-note">
        Receipts are written by the server with the Admin SDK. Firestore rules deny every
        client write, so you can read your own audit trail and nobody — including you —
        can forge one.
      </p>
    </section>
  );
}

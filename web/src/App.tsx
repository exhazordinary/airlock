import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { api, auth, db, signIn, signOut, watchAuth } from "./firebase";
import { DEMO_INJECTION, DEMO_PAYSLIP, DEMO_QUESTION } from "./demo";
import "./styles.css";

interface AskResponse {
  receiptId: string;
  verdict: "VERIFIED" | "CANNOT_VERIFY";
  answer?: string;
  reason?: string;
  value?: number;
  citedSpans?: string[];
  redactions: Record<string, number>;
  modelSaw: string;
  model: string | null;
  injectionFlagged: boolean;
  quota: { used: number; limit: number };
}

interface ReceiptRow {
  id: string;
  question?: string;
  verdict?: string;
  model?: string | null;
  latencyMs?: number;
  injectionFlagged?: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [doc, setDoc] = useState(DEMO_PAYSLIP);
  const [question, setQuestion] = useState(DEMO_QUESTION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [showModelView, setShowModelView] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);

  useEffect(() => watchAuth((u) => { setUser(u); setReady(true); }), []);

  useEffect(() => {
    if (!user) { setReceipts([]); return; }
    const q = query(
      collection(db, `users/${user.uid}/receipts`),
      orderBy("createdAt", "desc"),
      limit(8),
    );
    return onSnapshot(q, (snap) =>
      setReceipts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReceiptRow)),
    );
  }, [user]);

  async function ask() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api<AskResponse>("/api/ask", { document: doc, question }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="center"><p>Loading…</p></div>;

  if (!user) {
    return (
      <div className="center">
        <h1>AIRLOCK</h1>
        <p>
          An AI that hands you a receipt for every answer. Nothing sensitive goes in,
          nothing unproven comes out.
        </p>
        <button className="primary" onClick={() => signIn().catch((e) => setError(e.message))}>
          Sign in with Google
        </button>
        {error && <p className="err">{error}</p>}
      </div>
    );
  }

  const redactionCount = result
    ? Object.values(result.redactions).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="wrap">
      <header>
        <h1>AIRLOCK</h1>
        <p>Nothing sensitive goes in. Nothing unproven comes out.</p>
        <span className="muted">{user.email}</span>
        <button onClick={() => signOut()}>Sign out</button>
      </header>

      <div className="grid">
        <section className="panel">
          <h2>Document</h2>
          <textarea rows={16} value={doc} onChange={(e) => setDoc(e.target.value)} />
          <div className="row">
            <button onClick={() => setDoc(DEMO_PAYSLIP)}>Sample payslip</button>
            <button onClick={() => setDoc(DEMO_INJECTION)}>Injection attempt</button>
          </div>

          <h2 style={{ marginTop: "1.4rem" }}>Question</h2>
          <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="row">
            <button className="primary" onClick={ask} disabled={busy}>
              {busy ? "Checking…" : "Ask"}
            </button>
            {result && (
              <span className="muted">
                {result.quota.used}/{result.quota.limit} today
              </span>
            )}
          </div>
          {error && <p className="err">{error}</p>}
        </section>

        <section className="panel">
          <h2>Answer</h2>
          {!result && <p className="muted">Ask a question to see a verified answer.</p>}

          {result && (
            <>
              <div className="row">
                <span className={`badge ${result.verdict === "VERIFIED" ? "ok" : "no"}`}>
                  {result.verdict === "VERIFIED" ? "✓ VERIFIED" : "⚠ CANNOT VERIFY"}
                </span>
                {result.injectionFlagged && (
                  <span className="badge flag">⚑ INJECTION LOGGED</span>
                )}
                {result.model && <span className="chip">{result.model}</span>}
              </div>

              {result.verdict === "VERIFIED" ? (
                <p className="answer">{result.answer}</p>
              ) : (
                <p className="reason">{result.reason}</p>
              )}

              {result.citedSpans?.length ? (
                <div className="chips">
                  {result.citedSpans.map((s) => <span key={s} className="chip">{s}</span>)}
                </div>
              ) : null}

              <div className="row">
                <span className="badge ok">{redactionCount} redacted</span>
                {Object.entries(result.redactions).map(([k, v]) => (
                  <span key={k} className="chip">{k} × {v}</span>
                ))}
              </div>

              <div className="row">
                <button onClick={() => setShowModelView(!showModelView)}>
                  {showModelView ? "Hide what the model saw" : "Show what the model saw"}
                </button>
              </div>
              {showModelView && <pre>{result.modelSaw}</pre>}
            </>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1.25rem" }}>
        <h2>Trust ledger — your receipts</h2>
        {receipts.length === 0 && <p className="muted">No receipts yet.</p>}
        {receipts.map((r) => (
          <div key={r.id} className="receipt">
            <span className={`badge ${r.verdict === "VERIFIED" ? "ok" : "no"}`}>
              {r.verdict === "VERIFIED" ? "✓" : "⚠"}
            </span>
            <span className="q">{r.question}</span>
            {r.injectionFlagged && <span className="badge flag">⚑</span>}
            <span className="chip">{r.model ?? "—"}</span>
            <span className="chip">{r.latencyMs ?? 0} ms</span>
          </div>
        ))}
        <p className="muted" style={{ marginTop: ".9rem" }}>
          Receipts are written server-side only. Firestore rules deny client writes, so
          you can read your audit trail but cannot forge one.
        </p>
      </section>
    </div>
  );
}

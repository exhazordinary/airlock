import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { api, db, signIn, signOut, watchAuth } from "./firebase";
import { DEFAULT_SCENARIO, SCENARIOS } from "./demo";
import type { AskResponse, ReceiptRow } from "./types";
import Airlock from "./components/Airlock";
import Receipt from "./components/Receipt";
import Ledger from "./components/Ledger";
import "./styles.css";

const fingerprint = (doc: string, question: string, mode: string) =>
  `${mode} ${question} ${doc}`;

function SignedOut({ onSignIn, error }: { onSignIn: () => void; error: string }) {
  return (
    <main className="center">
      <p className="eyebrow">Gen AI Academy APAC · Cohort 3</p>
      <h1>AIRLOCK</h1>
      <p className="lede">
        An AI that hands you a receipt for every answer. Two deterministic gates flank the
        model: nothing sensitive goes in, nothing unproven comes out.
      </p>
      <ul className="claims">
        <li><strong>Gate 1</strong> masks personal data in code, before a model call exists.</li>
        <li><strong>Gate 2</strong> recomputes every figure from your own document.</li>
        <li><strong>Receipt</strong> records what was sent, what was cited, and what was proved.</li>
      </ul>
      <button className="primary" onClick={onSignIn}>Sign in with Google</button>
      {error && <p className="err" role="alert">{error}</p>}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [doc, setDoc] = useState(DEFAULT_SCENARIO.document);
  const [question, setQuestion] = useState(DEFAULT_SCENARIO.question);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [askedFor, setAskedFor] = useState("");
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [ledgerError, setLedgerError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => watchAuth((u) => { setUser(u); setReady(true); }), []);

  useEffect(() => {
    if (!user) { setReceipts([]); setLedgerError(""); return; }
    const q = query(
      collection(db, `users/${user.uid}/receipts`),
      orderBy("createdAt", "desc"),
      limit(12),
    );
    return onSnapshot(
      q,
      (snap) => {
        setLedgerError("");
        setReceipts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReceiptRow));
      },
      (e) => setLedgerError(e.message),
    );
  }, [user]);

  const mode = offline ? "replay" : "live";
  const stale = Boolean(result) && askedFor !== fingerprint(doc, question, mode);

  const status = useMemo(() => {
    if (busy) return "Checking. Gate 1 is masking your document.";
    if (error) return `Request failed. ${error}`;
    if (!result) return "";
    return result.verdict === "VERIFIED"
      ? `Verified. The answer is ${result.value}.`
      : `Cannot verify. ${result.reason ?? ""}`;
  }, [busy, error, result]);

  async function ask() {
    if (busy) return;
    setBusy(true);
    setError("");
    const asked = fingerprint(doc, question, mode);
    try {
      const res = await api<AskResponse>("/api/ask", { document: doc, question, mode });
      setResult(res);
      setAskedFor(asked);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <main className="center"><p role="status">Loading AIRLOCK</p></main>;
  }

  if (!user) {
    return (
      <SignedOut
        onSignIn={() => signIn().catch((e: Error) => setError(e.message))}
        error={error}
      />
    );
  }

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="brand">
          <h1>AIRLOCK</h1>
          <p>Nothing sensitive goes in. Nothing unproven comes out.</p>
        </div>
        <div className="who">
          <span className="muted">{user.email}</span>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <Airlock result={stale ? null : result} busy={busy} />

      <nav className="scenarios" aria-label="Demo scenarios">
        {SCENARIOS.map((s) => {
          const active = s.document === doc && s.question === question;
          return (
            <button
              key={s.key}
              className={`scenario${active ? " active" : ""}`}
              aria-pressed={active}
              onClick={() => { setDoc(s.document); setQuestion(s.question); }}
            >
              <strong>{s.label}</strong>
              <span>{s.blurb}</span>
              <span className="expect">{s.expect}</span>
            </button>
          );
        })}
      </nav>

      <div className="grid">
        <section className="panel">
          <h2>Document</h2>
          <label className="sr-only" htmlFor="doc">Document to analyse</label>
          <textarea
            id="doc"
            rows={17}
            spellCheck={false}
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
          />
          <p className="hint">
            Paste anything with <code>Label: value</code> rows. Gate 1 runs on the server
            before a model call exists, so raw personal data never reaches the provider.
          </p>

          <h2 className="spaced">Question</h2>
          <label className="sr-only" htmlFor="q">Question about the document</label>
          <input
            id="q"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void ask(); }}
          />

          <div className="row">
            <button className="primary" onClick={ask} disabled={busy}>
              {busy ? "Checking" : "Ask"}
            </button>
            <label className="toggle">
              <input
                type="checkbox"
                checked={offline}
                onChange={(e) => setOffline(e.target.checked)}
              />
              <span>Offline mode</span>
            </label>
            {result && (
              <span className="muted">{result.quota.used}/{result.quota.limit} today</span>
            )}
          </div>
          <p className="hint">
            Offline mode replays a plan recorded from a real model run. Both gates still
            run live, so an edited figure is recomputed rather than repeated.
          </p>
          {error && <p className="err" role="alert">{error}</p>}
        </section>

        <div className="panel result" tabIndex={-1} ref={resultRef}>
          <h2>Receipt</h2>
          <p className="sr-only" role="status" aria-live="polite">{status}</p>

          {!result && !busy && (
            <p className="muted">
              Pick a scenario, or paste your own document, and ask. Every answer arrives
              with the working attached.
            </p>
          )}
          {busy && !result && <p className="muted" aria-hidden="true">Checking</p>}
          {result && <Receipt result={result} stale={stale} />}
        </div>
      </div>

      <Ledger rows={receipts} error={ledgerError} />

      <footer className="colophon">
        <span>Firebase Auth · Firestore · Cloud Run · Gemini API</span>
        <span>asia-southeast1</span>
      </footer>
    </div>
  );
}

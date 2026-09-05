import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { api, db, signIn, signOut, watchAuth } from "./firebase";
import { DEFAULT_SCENARIO } from "./demo";
import type { Scenario } from "./demo";
import type { AskResponse, ReceiptRow } from "./types";
import SignedOut from "./components/SignedOut";
import Workspace from "./components/Workspace";
import "./styles.css";

const fingerprint = (document: string, question: string, mode: string): string =>
  `${mode} ${question} ${document}`;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [document, setDocument] = useState(DEFAULT_SCENARIO.document);
  const [question, setQuestion] = useState(DEFAULT_SCENARIO.question);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [askedFor, setAskedFor] = useState("");
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [ledgerError, setLedgerError] = useState("");
  const [walkthroughOpen, setWalkthroughOpen] = useState(true);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => watchAuth((nextUser) => {
    setUser(nextUser);
    setReady(true);
  }), []);

  useEffect(() => {
    if (!user) {
      setReceipts([]);
      setLedgerError("");
      return;
    }

    const receiptsQuery = query(
      collection(db, `users/${user.uid}/receipts`),
      orderBy("createdAt", "desc"),
      limit(12),
    );
    return onSnapshot(
      receiptsQuery,
      (snapshot) => {
        setLedgerError("");
        setReceipts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ReceiptRow));
      },
      (cause) => setLedgerError(cause.message),
    );
  }, [user]);

  const mode = offline ? "replay" : "live";
  const stale = Boolean(result) && askedFor !== fingerprint(document, question, mode);
  const status = useMemo(() => {
    if (busy) return "Checking securely. Personal details are being protected.";
    if (error) return `Request failed. ${error}`;
    if (!result) return "";
    return result.verdict === "VERIFIED"
      ? `Verified. The answer is ${result.value}.`
      : `Cannot verify. ${result.reason ?? "No figure was produced."}`;
  }, [busy, error, result]);

  const chooseScenario = (scenario: Scenario) => {
    setDocument(scenario.document);
    setQuestion(scenario.question);
  };

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const requestFingerprint = fingerprint(document, question, mode);

    try {
      const response = await api<AskResponse>("/api/ask", { document, question, mode });
      setResult(response);
      setAskedFor(requestFingerprint);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return <main className="loading-page"><p role="status">Preparing your private workspace…</p></main>;
  }

  if (!user) {
    return (
      <SignedOut
        onSignIn={() => signIn().catch((cause: Error) => setError(cause.message))}
        error={error}
      />
    );
  }

  return (
    <Workspace
      email={user.email ?? "Signed-in account"}
      document={document}
      question={question}
      offline={offline}
      busy={busy}
      status={status}
      error={error}
      result={result}
      stale={stale}
      receipts={receipts}
      ledgerError={ledgerError}
      walkthroughOpen={walkthroughOpen}
      resultRef={resultRef}
      onDocumentChange={setDocument}
      onQuestionChange={setQuestion}
      onOfflineChange={setOffline}
      onAsk={() => void ask()}
      onSignOut={() => void signOut()}
      onScenarioSelect={chooseScenario}
      onWalkthroughOpenChange={setWalkthroughOpen}
    />
  );
}

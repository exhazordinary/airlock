import type { ReactNode, Ref } from "react";
import { useRef, useState } from "react";
import { SCENARIOS } from "../demo";
import type { Scenario } from "../demo";
import type { AskResponse, ReceiptRow } from "../types";
import Airlock from "./Airlock";
import JudgeWalkthrough from "./JudgeWalkthrough";
import Ledger from "./Ledger";
import QuestionBar from "./QuestionBar";
import Receipt from "./Receipt";
import ScenarioPicker from "./ScenarioPicker";
import DocumentUpload from "./DocumentUpload";
import { suggestQuestions } from "../documentImport";
import { sourceRow } from "../pdfSource";
import type { PdfSource } from "../pdfSource";
import PdfEvidence from "./PdfEvidence";

export default function Workspace({
  email,
  document,
  question,
  offline,
  busy,
  status,
  error,
  result,
  stale,
  receipts,
  ledgerError,
  walkthroughOpen,
  resultRef,
  utilityActions,
  onDocumentChange,
  onQuestionChange,
  onOfflineChange,
  onAsk,
  onSignOut,
  onScenarioSelect,
  onWalkthroughRun,
  onWalkthroughOpenChange,
}: {
  email: string;
  document: string;
  question: string;
  offline: boolean;
  busy: boolean;
  status: string;
  error: string;
  result: AskResponse | null;
  stale: boolean;
  receipts: ReceiptRow[];
  ledgerError: string;
  walkthroughOpen: boolean;
  resultRef?: Ref<HTMLElement>;
  utilityActions?: ReactNode;
  onDocumentChange: (document: string) => void;
  onQuestionChange: (question: string) => void;
  onOfflineChange: (offline: boolean) => void;
  onAsk: () => void;
  onSignOut: () => void;
  onScenarioSelect: (scenario: Scenario) => void;
  onWalkthroughRun: (scenario: Scenario) => void;
  onWalkthroughOpenChange: (open: boolean) => void;
}) {
  const [pdf, setPdf] = useState<PdfSource | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const evidenceRef = useRef<HTMLDivElement>(null);
  const locateSource = (id: string) => {
    if (stale || !sourceRow(pdf, document, id)) return;
    setSelectedId(id);
    requestAnimationFrame(() => {
      evidenceRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      evidenceRef.current?.focus({ preventScroll: true });
    });
  };
  const activeKey = SCENARIOS.find(
    (scenario) => scenario.document === document && scenario.question === question,
  )?.key ?? "";

  return (
    <div className="wrap">
      <header className="masthead">
        <a className="brand" href="/" aria-label="AIRLOCK home">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span><strong>AIRLOCK</strong><small>Answers with proof attached</small></span>
        </a>
        <div className="who">
          <span className="avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase() || "U"}</span>
          <span className="account-email">{email}</span>
          {utilityActions}
          <button className="quiet-button" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      {walkthroughOpen ? (
        <JudgeWalkthrough
          activeKey={activeKey}
          result={result}
          stale={stale}
          busy={busy}
          onSelect={onScenarioSelect}
          onRun={onWalkthroughRun}
          onDismiss={() => onWalkthroughOpenChange(false)}
        />
      ) : (
        <button className="reopen-tour" type="button" onClick={() => onWalkthroughOpenChange(true)}>
          Open the two-minute judge walkthrough
        </button>
      )}

      <ScenarioPicker scenarios={SCENARIOS} activeKey={activeKey} onSelect={onScenarioSelect} />

      <main className="workspace">
        <section className="panel document-panel" aria-labelledby="document-title">
          <div className="section-heading">
            <div>
              <h2 id="document-title">Your document</h2>
              <p>Upload a payslip, bill, or invoice, or try an example above.</p>
            </div>
            <span className="privacy-badge">Protected before AI</span>
          </div>
          <DocumentUpload busy={busy} onAccept={(text, source) => {
            setPdf(source ?? null);
            setSelectedId(undefined);
            onDocumentChange(text);
            onQuestionChange(suggestQuestions(text)[0] ?? "");
            onOfflineChange(false);
            onWalkthroughOpenChange(false);
          }} />
          {pdf && <div className="accepted-pdf" ref={evidenceRef} tabIndex={-1} aria-label="PDF source locations">
            <div className="section-heading"><h3>Your original PDF</h3>
              <button type="button" className="quiet-button" onClick={() => setPdf(null)}>Close PDF preview</button></div>
            {document !== pdf.text && <p className="hint">Document text has changed. These are the original extracted rows; receipt location links are disabled.</p>}
            <PdfEvidence pdf={pdf} selectedId={selectedId} onSelect={(row) => setSelectedId(row.id)} />
            <p className="hint">The PDF is kept only for this session. Reopen it after a reload to inspect its locations again.</p>
          </div>}
          <label className="field-label" htmlFor="document">Document text — paste or edit</label>
          <textarea
            id="document"
            rows={17}
            spellCheck={false}
            aria-label="Document to check"
            value={document}
            onChange={(event) => onDocumentChange(event.target.value)}
          />
          <p className="hint">
            Plain <code>Label: value</code> rows work best. Personal details are replaced
            with safe tokens on the server before a model call can exist.
          </p>
          <QuestionBar
            suggestions={suggestQuestions(document)}
            question={question}
            offline={offline}
            busy={busy}
            result={result}
            onQuestionChange={onQuestionChange}
            onOfflineChange={onOfflineChange}
            onAsk={onAsk}
          />
          {error && <p className="err" role="alert">This check could not finish. {error}</p>}
        </section>

        <section className="panel result" tabIndex={-1} ref={resultRef} aria-labelledby="receipt-title">
          <div className="section-heading">
            <div>
              <h2 id="receipt-title">Proof receipt</h2>
              <p>The answer, its working, and the exact lines that support it.</p>
            </div>
          </div>
          <p className="sr-only" role="status" aria-live="polite">{status}</p>
          <Airlock result={stale ? null : result} busy={busy} />

          {!result && !busy && (
            <div className="empty-receipt">
              <span aria-hidden="true">✓</span>
              <h3>Your proof will appear here</h3>
              <p>Choose an example or paste a document, then check a question.</p>
            </div>
          )}
          {busy && <div className="receipt-skeleton" aria-hidden="true"><span /><span /><span /></div>}
          {result && !busy && <Receipt result={result} stale={stale}
            onLocateSource={pdf && document === pdf.text && !stale ? locateSource : undefined} />}
        </section>
      </main>

      <Ledger rows={receipts} error={ledgerError} />

      <footer className="colophon">
        <span>Firebase Authentication</span>
        <span>Cloud Firestore</span>
        <span>Cloud Run</span>
        <span>Gemini API</span>
        <small>Built and hosted in asia-southeast1</small>
      </footer>
    </div>
  );
}

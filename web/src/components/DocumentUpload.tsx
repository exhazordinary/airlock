import { useEffect, useRef, useState } from "react";
import { importDocument, normalizeDocumentText } from "../documentImport";

export default function DocumentUpload({ busy, onAccept }: { busy: boolean; onAccept: (text: string) => void }) {
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const read = async (file: File) => {
    const current = ++generation.current;
    setReading(true);
    setDraft(null);
    setError("");
    try {
      const text = await importDocument(file);
      if (current === generation.current) setDraft(text);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : "This file could not be read.");
    } finally {
      if (current === generation.current) setReading(false);
    }
  };

  const accept = () => {
    try {
      const text = normalizeDocumentText(draft ?? "");
      onAccept(text);
      setDraft(null);
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return (
    <div className="document-upload">
      <label className="field-label" htmlFor="document-file">Upload a document</label>
      <p>Skip the retyping. Choose a text-based PDF or TXT file.</p>
      <input id="document-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" disabled={busy || reading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }} />
      <p className="hint">Up to 10 MB, 20 PDF pages, and 20,000 characters. The file is read on this device. Only text you approve is sent when you check an answer.</p>
      {reading && <p role="status">Reading your document on this device…</p>}
      {draft !== null && (
        <div className="import-review">
          <label className="field-label" htmlFor="import-review">Review extracted text</label>
          <p>Check each label and amount against the original, especially columns. Fix any broken rows before continuing. This replaces the document below.</p>
          <textarea id="import-review" rows={10} value={draft} maxLength={20000} onChange={(event) => setDraft(event.target.value)} />
          <div className="import-actions">
            <button type="button" className="primary" disabled={busy || !draft.trim()} onClick={accept}>Use this document</button>
            <button type="button" className="quiet-button" onClick={() => { setDraft(null); setError(""); }}>Discard import</button>
          </div>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

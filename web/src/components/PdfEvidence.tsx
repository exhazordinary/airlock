import { lazy, Suspense, useState } from "react";
import type { PdfRow, PdfSource } from "../pdfSource";
const PdfPreview = lazy(() => import("./PdfPreview"));

export default function PdfEvidence({ pdf, selectedId, onSelect }: {
  pdf: PdfSource; selectedId?: string; onSelect?: (row: PdfRow) => void;
}) {
  const [localId, setLocalId] = useState(pdf.rows[0]?.id);
  const selected = pdf.rows.find((row) => row.id === (selectedId ?? localId)) ?? pdf.rows[0];
  const select = (row: PdfRow) => { setLocalId(row.id); onSelect?.(row); };
  return <div className="pdf-evidence">
    <Suspense fallback={<p role="status">Opening local PDF preview…</p>}>
      <PdfPreview pdf={pdf} selected={selected} onSelect={select} />
    </Suspense>
    <section className="extracted-rows" aria-label="Extracted rows">
      <h3>Text found in your PDF</h3>
      <p>Choose a line to see where it appears.</p>
      <ol>{pdf.rows.map((row) => <li key={row.id}>
        <button type="button" className="quiet-button" aria-pressed={selected?.id === row.id} onClick={() => select(row)}>
          <small>Page {row.page} · {row.id}</small><span>{row.text}</span>
        </button>
      </li>)}</ol>
    </section>
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { RenderTask } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PdfRow, PdfSource } from "../pdfSource";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPreview({ pdf, selected, onSelect }: {
  pdf: PdfSource; selected: PdfRow | undefined; onSelect: (row: PdfRow) => void;
}) {
  const [page, setPage] = useState(selected?.page ?? 1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const movePage = (number: number) => {
    setPage(number);
    const row = pdf.rows.find((item) => item.page === number);
    if (row) onSelect(row);
  };
  useEffect(() => { if (selected) setPage(selected.page); }, [selected]);
  useEffect(() => {
    let cancelled = false;
    let render: RenderTask | undefined;
    setReady(false);
    setError("");
    const task = getDocument({ data: pdf.data.slice(0), useSystemFonts: true });
    const timer = setTimeout(() => {
      if (!cancelled) setError("Preview took too long. You can still review the extracted text.");
      render?.cancel();
      void task.destroy();
    }, 20000);
    void (async () => {
      try {
        const document = await task.promise;
        if (cancelled) return;
        const source = await document.getPage(page);
        if (cancelled || !canvas.current) return;
        const base = source.getViewport({ scale: 1 });
        const viewport = source.getViewport({ scale: Math.min(2, 1600 / Math.max(base.width, base.height)) });
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        render = source.render({ canvas: canvas.current, viewport });
        await render.promise;
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setError("This page could not be previewed. Check it in your PDF reader before using the extracted text.");
      } finally {
        clearTimeout(timer);
        await task.destroy();
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); render?.cancel(); void task.destroy(); };
  }, [pdf, page]);

  return <section className="pdf-preview" aria-label="Original PDF">
    <div className="pdf-navigation">
      <button type="button" className="quiet-button" disabled={page === 1} onClick={() => movePage(page - 1)}>Previous page</button>
      <span>Page {page} of {pdf.pageCount}</span>
      <button type="button" className="quiet-button" disabled={page === pdf.pageCount} onClick={() => movePage(page + 1)}>Next page</button>
    </div>
    <p className="hint">Original file · stays on this device. Select a row to locate its text. Highlights show approximate extraction locations, not proof of accuracy.</p>
    {error ? <p role="alert" className="err">{error}</p> : !ready && <p role="status">Drawing page {page}…</p>}
    <div className="pdf-page" style={{ display: ready ? "block" : "none" }}>
      <canvas ref={canvas} role="img" aria-label={`Original PDF page ${page}`} />
      {ready && pdf.rows.filter((row) => row.page === page).flatMap((row) => row.boxes.map((box, index) =>
        <button key={`${row.id}-${index}`} type="button" className={`pdf-highlight${selected?.id === row.id ? " selected" : ""}`}
          style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
          aria-label={`Locate ${row.text}`} aria-pressed={selected?.id === row.id} onClick={() => onSelect(row)} />
      ))}
    </div>
    {selected && <p className="pdf-selection" role="status">Selected on page {selected.page}: {selected.text}</p>}
  </section>;
}

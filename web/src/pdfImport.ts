import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { PdfBox, PdfRow, PdfSource } from "./pdfSource";
import { normalizeDocumentText } from "./documentImport";

GlobalWorkerOptions.workerSrc = workerUrl;

export const extractPdfSource = async (data: ArrayBuffer): Promise<PdfSource> => {
  const task = getDocument({ data: data.slice(0), useSystemFonts: true });
  const timeout = setTimeout(() => void task.destroy(), 20000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 20) throw new Error("Choose a PDF with 20 pages or fewer.");
    const pages: string[] = [];
    const rows: PdfRow[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      let text = "";
      let line = "";
      let boxes: PdfBox[] = [];
      const flush = () => {
        if (line.trim()) rows.push({ id: `s${rows.length + 1}`, text: line.trim(), page: number, boxes });
        line = "";
        boxes = [];
      };
      let previous: TextItem | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        if (previous && !text.endsWith("\n")) {
          const newLine = Math.abs(item.transform[5] - previous.transform[5]) > Math.max(2, previous.height / 2);
          const gap = item.transform[4] - (previous.transform[4] + previous.width);
          const separator = newLine ? "\n" : gap > 8 ? "\t" : " ";
          text += separator;
          if (newLine) flush();
          else line += separator;
        }
        text += item.str + (item.hasEOL ? "\n" : "");
        line += item.str;
        if (item.str.trim()) {
          const [a, b, c, d, x, y] = item.transform;
          const horizontal = Math.hypot(a, b) || 1;
          const vertical = Math.hypot(c, d) || 1;
          const corners = [
            [x - c / vertical * item.height * .2, y - d / vertical * item.height * .2],
            [x + a / horizontal * item.width - c / vertical * item.height * .2, y + b / horizontal * item.width - d / vertical * item.height * .2],
            [x + c / vertical * item.height * .85, y + d / vertical * item.height * .85],
            [x + a / horizontal * item.width + c / vertical * item.height * .85, y + b / horizontal * item.width + d / vertical * item.height * .85],
          ].map(([px, py]) => viewport.convertToViewportPoint(px, py));
          const xs = corners.map(([px]) => px), ys = corners.map(([, py]) => py);
          boxes.push({ left: Math.min(...xs) / viewport.width * 100, top: Math.min(...ys) / viewport.height * 100,
            width: (Math.max(...xs) - Math.min(...xs)) / viewport.width * 100, height: (Math.max(...ys) - Math.min(...ys)) / viewport.height * 100 });
        }
        if (item.hasEOL) flush();
        previous = item;
      }
      flush();
      if (!text.trim()) throw new Error("A page has no readable text. Scanned PDFs are not supported yet; paste the text from your device's text recognition instead.");
      pages.push(text);
      if (pages.join("\n\n").length > 20000) throw new Error("This document exceeds 20,000 characters. Choose a shorter document.");
      page.cleanup();
    }
    const text = normalizeDocumentText(pages.join("\n\n"));
    if (text.split("\n").map((line) => line.trim()).filter(Boolean).join("\n") !== rows.map((row) => row.text).join("\n")) {
      throw new Error("PDF line locations could not be matched reliably.");
    }
    return { text, data, pageCount: pdf.numPages, rows };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "PasswordException") throw new Error("This PDF is password-protected. Unlock a copy on your device first.");
    if (cause instanceof Error && /Choose a|readable text|20,000/.test(cause.message)) throw cause;
    throw new Error("This PDF could not be read. It may be damaged or too complex. Try a simpler PDF or paste its text.");
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
};

export const extractPdfText = async (data: ArrayBuffer): Promise<string> => (await extractPdfSource(data)).text;

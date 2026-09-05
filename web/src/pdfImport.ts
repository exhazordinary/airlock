import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

GlobalWorkerOptions.workerSrc = workerUrl;

export const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
  const task = getDocument({ data, useSystemFonts: true });
  const timeout = setTimeout(() => void task.destroy(), 20000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 20) throw new Error("Choose a PDF with 20 pages or fewer.");
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = "";
      let previous: TextItem | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        if (previous && !text.endsWith("\n")) {
          const newLine = Math.abs(item.transform[5] - previous.transform[5]) > Math.max(2, previous.height / 2);
          const gap = item.transform[4] - (previous.transform[4] + previous.width);
          text += newLine ? "\n" : gap > 8 ? "\t" : " ";
        }
        text += item.str + (item.hasEOL ? "\n" : "");
        previous = item;
      }
      if (!text.trim()) throw new Error("A page has no readable text. Scanned PDFs are not supported yet; paste the text from your device's text recognition instead.");
      pages.push(text);
      if (pages.join("\n\n").length > 20000) throw new Error("This document exceeds 20,000 characters. Choose a shorter document.");
      page.cleanup();
    }
    return pages.join("\n\n");
  } catch (cause) {
    if (cause instanceof Error && cause.name === "PasswordException") throw new Error("This PDF is password-protected. Unlock a copy on your device first.");
    if (cause instanceof Error && /Choose a|readable text|20,000/.test(cause.message)) throw cause;
    throw new Error("This PDF could not be read. It may be damaged or too complex. Try a simpler PDF or paste its text.");
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
};

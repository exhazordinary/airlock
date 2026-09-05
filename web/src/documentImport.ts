export const validateUpload = (file: { name: string; size: number }) => {
  if (!/\.(pdf|txt)$/i.test(file.name)) throw new Error("Choose a PDF or TXT file. Photos and scanned documents are not supported yet.");
  if (!file.size) throw new Error("This file is empty. Choose another document.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose a file smaller than 10 MB.");
};

export const normalizeDocumentText = (text: string): string => {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("No readable text found. For a scanned PDF, copy its text using your device's text recognition, then paste it here.");
  if (normalized.length > 20000) throw new Error("This document exceeds 20,000 characters. Choose a shorter document or paste only the relevant section.");
  if (/[\u0000-\u0008\u000e-\u001f\ufffd]/.test(normalized)) throw new Error("This text could not be read reliably. Save it as UTF-8 text and try again.");
  return normalized;
};

export const suggestQuestions = (text: string): string[] => {
  const questions: string[] = [];
  if (/gross pay/i.test(text)) questions.push("How much was deducted from my gross pay in total?");
  if (/gross pay/i.test(text) && /epf/i.test(text)) questions.push("What percentage of my gross pay went to EPF?");
  if (/net pay/i.test(text)) questions.push("What is my net pay?");
  if (/amount due|invoice/i.test(text)) questions.push("What is the total amount due on this invoice?");
  if (/balance/i.test(text)) questions.push("What is the outstanding balance?");
  return questions.slice(0, 3);
};

export const importDocument = async (file: File): Promise<string> => {
  validateUpload(file);
  if (/\.txt$/i.test(file.name)) return normalizeDocumentText(await file.text());
  const { extractPdfText } = await import("./pdfImport");
  return normalizeDocumentText(await extractPdfText(await file.arrayBuffer()));
};

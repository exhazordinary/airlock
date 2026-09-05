export interface PdfBox { left: number; top: number; width: number; height: number }
export interface PdfRow { id: string; text: string; page: number; boxes: PdfBox[] }
export interface PdfSource { text: string; data: ArrayBuffer; pageCount: number; rows: PdfRow[] }

export const sourceRow = (pdf: PdfSource | null, text: string, id: string): PdfRow | undefined =>
  pdf?.text === text ? pdf.rows.find((row) => row.id === id) : undefined;

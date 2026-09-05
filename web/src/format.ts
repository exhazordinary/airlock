/** Matches the server's formatting so a figure reads identically wherever it appears. */
export const formatValue = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

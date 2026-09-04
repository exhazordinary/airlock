import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import type { RedactionKind } from "./gates/redact.js";

export interface Receipt {
  question: string;
  redactions: Partial<Record<RedactionKind, number>>;
  modelSaw: string;
  model: string | null;
  verdict: "VERIFIED" | "CANNOT_VERIFY";
  reason?: string;
  answer?: string;
  value?: number;
  citedSpans?: string[];
  injectionFlagged: boolean;
  latencyMs: number;
}

/** Written only via the Admin SDK, which bypasses rules. Clients cannot forge one. */
export async function writeReceipt(uid: string, receipt: Receipt): Promise<string> {
  const ref = db.collection(`users/${uid}/receipts`).doc();
  await ref.set({ ...receipt, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

import { db } from "./firebase.js";

export interface Quota {
  ok: boolean;
  used: number;
  limit: number;
}

const DEFAULT_LIMIT = Number(process.env.DAILY_LIMIT) || 25;

/** Per-UID daily bucket. Server-written; Firestore rules deny client writes. */
export async function consume(uid: string, limit = DEFAULT_LIMIT): Promise<Quota> {
  const ref = db.doc(`users/${uid}/quota/current`);
  const today = new Date().toISOString().slice(0, 10);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() ?? {}) : {};
    const used = data.day === today ? Number(data.used ?? 0) : 0;

    if (used >= limit) return { ok: false, used, limit };

    tx.set(ref, { day: today, used: used + 1, limit }, { merge: true });
    return { ok: true, used: used + 1, limit };
  });
}

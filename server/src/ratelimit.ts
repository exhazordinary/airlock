import { db } from "./firebase.js";

export type QuotaScope = "user" | "service";

export interface Quota {
  ok: boolean;
  used: number;
  limit: number;
  scope?: QuotaScope;
}

const USER_LIMIT = Number(process.env.DAILY_LIMIT) || 25;
const SERVICE_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT) || 300;

const today = (): string => new Date().toISOString().slice(0, 10);

const tally = (data: Record<string, unknown> | undefined, day: string): number =>
  data?.day === day ? Number(data.used ?? 0) : 0;

/**
 * One transaction covers both buckets, so a request that the service-wide ceiling
 * rejects never burns the caller's own allowance. Server-written; rules deny clients.
 */
export async function consume(
  uid: string,
  userLimit = USER_LIMIT,
  serviceLimit = SERVICE_LIMIT,
): Promise<Quota> {
  const userRef = db.doc(`users/${uid}/quota/current`);
  const serviceRef = db.doc("system/quota");
  const day = today();

  return db.runTransaction(async (tx) => {
    const [userSnap, serviceSnap] = await tx.getAll(userRef, serviceRef);
    const used = tally(userSnap.data(), day);
    const serviceUsed = tally(serviceSnap.data(), day);

    if (serviceUsed >= serviceLimit) {
      return { ok: false, used: serviceUsed, limit: serviceLimit, scope: "service" as const };
    }
    if (used >= userLimit) {
      return { ok: false, used, limit: userLimit, scope: "user" as const };
    }

    tx.set(userRef, { day, used: used + 1, limit: userLimit }, { merge: true });
    tx.set(serviceRef, { day, used: serviceUsed + 1, limit: serviceLimit }, { merge: true });
    return { ok: true, used: used + 1, limit: userLimit };
  });
}

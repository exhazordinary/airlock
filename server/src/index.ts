import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { requireAuth, type AuthedRequest } from "./auth.js";
import { consume } from "./ratelimit.js";
import { extractSpans } from "./spans.js";
import { Redactor } from "./gates/redact.js";
import { evaluatePlan } from "./gates/compute.js";
import { buildPrompt, requestPlan, looksLikeInjection } from "./gemini.js";
import { writeReceipt } from "./receipts.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "airlock", ts: new Date().toISOString() });
});

app.post("/api/ask", requireAuth, async (req, res) => {
  const uid = (req as AuthedRequest).uid!;
  const started = Date.now();

  const document = String(req.body?.document ?? "");
  const question = String(req.body?.question ?? "");
  if (!document.trim() || !question.trim()) {
    res.status(400).json({ error: "Both document and question are required." });
    return;
  }

  const quota = await consume(uid);
  if (!quota.ok) {
    res.status(429).json({
      error: `Daily limit of ${quota.limit} questions reached. Resets at midnight UTC.`,
    });
    return;
  }

  const injectionFlagged = looksLikeInjection(document) || looksLikeInjection(question);

  // GATE 1 runs before any Gemini call exists in this path.
  const redactor = new Redactor();
  const spans = redactor.redactSpans(extractSpans(document));
  const safeQuestion = redactor.mask(question);
  const modelSaw = buildPrompt(safeQuestion, spans);

  let model: string | null = null;
  let verdict;
  if (injectionFlagged) {
    verdict = {
      status: "CANNOT_VERIFY" as const,
      reason: "Potential prompt injection detected. Nothing was sent to the AI service.",
    };
  } else {
    try {
      const result = await requestPlan(modelSaw);
      model = result.model;
      // GATE 2.
      verdict = evaluatePlan(result.plan, spans);
    } catch {
      verdict = {
        status: "CANNOT_VERIFY" as const,
        reason: "AIRLOCK could not safely verify an answer. Please try again.",
      };
    }
  }

  const answer =
    verdict.status === "VERIFIED" ? redactor.unmask(verdict.answer) : undefined;

  const receiptId = await writeReceipt(uid, {
    question,
    redactions: redactor.ledger,
    modelSaw,
    model,
    verdict: verdict.status,
    ...(verdict.status === "CANNOT_VERIFY" ? { reason: verdict.reason } : {}),
    ...(verdict.status === "VERIFIED"
      ? { answer, value: verdict.value, citedSpans: verdict.cited }
      : {}),
    injectionFlagged,
    latencyMs: Date.now() - started,
  });

  res.json({
    receiptId,
    verdict: verdict.status,
    answer,
    reason: verdict.status === "CANNOT_VERIFY" ? verdict.reason : undefined,
    value: verdict.status === "VERIFIED" ? verdict.value : undefined,
    citedSpans: verdict.status === "VERIFIED" ? verdict.cited : undefined,
    redactions: redactor.ledger,
    modelSaw,
    model,
    injectionFlagged,
    quota: { used: quota.used, limit: quota.limit },
  });
});

app.use(express.static(publicDir));
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => console.log(`airlock listening on ${port}`));

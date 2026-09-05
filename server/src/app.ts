import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { requireAuth, type AuthedRequest } from "./auth.js";
import { consume } from "./ratelimit.js";
import { extractSpans } from "./spans.js";
import { Redactor, type Span } from "./gates/redact.js";
import { evaluatePlan, type Verdict } from "./gates/compute.js";
import { buildPrompt, requestPlan, looksLikeInjection } from "./gemini.js";
import { replayPlan } from "./replay.js";
import { writeReceipt } from "./receipts.js";
import { securityHeaders } from "./security.js";
import { errorHandler, route } from "./errors.js";
import { validateAsk } from "./validate.js";

type PipelineCode = "INJECTION_BLOCKED" | "PROVIDER_UNAVAILABLE" | "NO_RECORDING";
type AskVerdict = Verdict | { status: "CANNOT_VERIFY"; reason: string; code: PipelineCode };

const INJECTION_BLOCKED =
  "Prompt injection detected in the input. Nothing was sent to the AI service.";
const PROVIDER_UNAVAILABLE =
  "AIRLOCK could not obtain a plan it was able to verify. No answer was produced.";
const NO_RECORDING =
  "Offline mode holds no recorded plan for this question. Nothing was invented in its place.";

/** The redacted spans are exactly what crossed the inner door, so they are safe to show. */
const publicSpans = (spans: Span[]) =>
  spans.map((s) => ({
    id: s.id,
    text: s.text,
    value: s.value ?? null,
    label: s.rowLabel ?? null,
    isTotal: Boolean(s.isTotal),
    redacted: Boolean(s.redacted),
    redactionType: s.redactionType ?? null,
  }));

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "256kb" }));

  const here = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(here, "../public");

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "airlock", ts: new Date().toISOString() });
  });

  app.post("/api/ask", requireAuth, route(async (req, res) => {
    const uid = (req as AuthedRequest).uid!;
    const started = Date.now();

    const parsed = validateAsk(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { document, question, mode } = parsed.input;

    const quota = await consume(uid);
    if (!quota.ok) {
      res.status(429).json({
        error:
          quota.scope === "service"
            ? "AIRLOCK has reached its daily service-wide budget. Try again after midnight UTC."
            : `Daily limit of ${quota.limit} questions reached. Resets at midnight UTC.`,
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
    let replayed = false;
    let verdict: AskVerdict;

    const fromRecording = (offline: boolean): AskVerdict => {
      const recorded = replayPlan(safeQuestion, spans);
      if (!recorded) {
        return offline
          ? { status: "CANNOT_VERIFY", reason: NO_RECORDING, code: "NO_RECORDING" }
          : { status: "CANNOT_VERIFY", reason: PROVIDER_UNAVAILABLE, code: "PROVIDER_UNAVAILABLE" };
      }
      replayed = true;
      // GATE 2 still runs, against this document's live spans.
      return evaluatePlan(recorded, spans);
    };

    if (injectionFlagged) {
      verdict = {
        status: "CANNOT_VERIFY",
        reason: INJECTION_BLOCKED,
        code: "INJECTION_BLOCKED",
      };
    } else if (mode === "replay") {
      verdict = fromRecording(true);
    } else {
      try {
        const result = await requestPlan(modelSaw);
        model = result.model;
        // GATE 2.
        verdict = evaluatePlan(result.plan, spans);
      } catch {
        verdict = fromRecording(false);
      }
    }

    const answer = verdict.status === "VERIFIED" ? verdict.answer : undefined;

    const receiptId = await writeReceipt(uid, {
      question: safeQuestion,
      redactions: redactor.ledger,
      modelSaw,
      model,
      replayed,
      verdict: verdict.status,
      ...(verdict.status === "CANNOT_VERIFY"
        ? { reason: verdict.reason, code: verdict.code }
        : {}),
      ...(verdict.status === "VERIFIED"
        ? {
            answer,
            value: verdict.value,
            citedSpans: verdict.cited,
            trace: verdict.trace,
            sources: verdict.sources,
          }
        : {}),
      injectionFlagged,
      latencyMs: Date.now() - started,
    });

    res.json({
      receiptId,
      question: safeQuestion,
      verdict: verdict.status,
      answer,
      reason: verdict.status === "CANNOT_VERIFY" ? verdict.reason : undefined,
      code: verdict.status === "CANNOT_VERIFY" ? verdict.code : undefined,
      value: verdict.status === "VERIFIED" ? verdict.value : undefined,
      citedSpans: verdict.status === "VERIFIED" ? verdict.cited : undefined,
      trace: verdict.status === "VERIFIED" ? verdict.trace : undefined,
      sources: verdict.status === "VERIFIED" ? verdict.sources : undefined,
      spans: publicSpans(spans),
      redactions: redactor.ledger,
      modelSaw,
      model,
      replayed,
      injectionFlagged,
      latencyMs: Date.now() - started,
      quota: { used: quota.used, limit: quota.limit },
    });
  }));

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  app.use(errorHandler);

  return app;
}

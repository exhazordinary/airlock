import { useEffect, useState } from "react";
import type { AskResponse } from "../types";
import { formatValue } from "../format";

type Tone = "idle" | "busy" | "pass" | "warn" | "block";

interface Stage {
  key: string;
  label: string;
  title: string;
  detail: string;
  tone: Tone;
}

const masked = (result: AskResponse): number =>
  Object.values(result.redactions).reduce((total, count) => total + count, 0);

const idleStages = (busy: boolean): Stage[] => [
  {
    key: "privacy",
    label: "Gate 1",
    title: "Personal details protected",
    detail: busy ? "Masking sensitive values now" : "Ready for your document",
    tone: busy ? "busy" : "idle",
  },
  {
    key: "plan",
    label: "Gemini",
    title: "AI creates a plan",
    detail: busy ? "Waiting behind the privacy gate" : "No document sent",
    tone: "idle",
  },
  {
    key: "proof",
    label: "Gate 2",
    title: "Answer checked against your document",
    detail: busy ? "Waiting for a safe plan" : "No plan checked",
    tone: "idle",
  },
  {
    key: "answer",
    label: "Receipt",
    title: busy ? "Answer held until verified" : "Your proof appears here",
    detail: busy ? "Nothing is released early" : "none yet",
    tone: "idle",
  },
];

const resultStages = (result: AskResponse): Stage[] => {
  const blocked = result.injectionFlagged;
  const verified = result.verdict === "VERIFIED";
  const noRecording = result.code === "NO_RECORDING";
  const maskedTotal = masked(result);

  return [
    {
      key: "privacy",
      label: "Gate 1",
      title: "Personal details protected",
      detail: maskedTotal === 0 ? "Nothing sensitive found" : `${maskedTotal} values masked before AI`,
      tone: "pass",
    },
    {
      key: "plan",
      label: "Gemini",
      title: "AI creates a plan",
      detail: blocked
        ? "never opened"
        : result.replayed
          ? "Recorded plan used"
          : noRecording
            ? "No matching plan available"
            : (result.model ?? "Provider unavailable"),
      tone: blocked ? "block" : result.replayed || noRecording ? "warn" : "pass",
    },
    {
      key: "proof",
      label: "Gate 2",
      title: "Answer checked against your document",
      detail: verified
        ? `${result.sources?.length ?? 0} source lines recomputed`
        : blocked
          ? "Unsafe input stopped"
          : "No proof accepted",
      tone: verified ? "pass" : blocked ? "block" : "warn",
    },
    {
      key: "answer",
      label: "Receipt",
      title: verified ? "Answer released" : "Answer withheld",
      detail: verified ? formatValue(result.value) : "No figure produced",
      tone: verified ? "pass" : blocked ? "block" : "warn",
    },
  ];
};

const icon = (tone: Tone): string => {
  if (tone === "pass") return "✓";
  if (tone === "block") return "!";
  if (tone === "warn") return "–";
  if (tone === "busy") return "•";
  return "○";
};

export default function Airlock({
  result,
  busy,
}: {
  result: AskResponse | null;
  busy: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 100);
    return () => window.clearInterval(timer);
  }, [busy]);

  const stages = result && !busy ? resultStages(result) : idleStages(busy);

  return (
    <section className={`airlock${busy ? " is-busy" : ""}`} aria-labelledby="airlock-title">
      <header className="airlock-head">
        <div>
          <h3 id="airlock-title">{busy ? "Checking securely" : "How this check is protected"}</h3>
          <p>Both safety doors are never open at the same time.</p>
        </div>
        {busy && <output className="elapsed">Elapsed {(elapsed / 1000).toFixed(1)}s</output>}
      </header>

      <ol className="chain">
        {stages.map((stage) => (
          <li key={stage.key} className={`stage tone-${stage.tone}`}>
            <span className="stage-status" aria-hidden="true">{icon(stage.tone)}</span>
            <span className="stage-copy">
              <span className="kicker">{stage.label}</span>
              <strong>{stage.title}</strong>
              <span className="detail">{stage.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

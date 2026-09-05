import type { AskResponse } from "../types";
import { formatValue } from "../format";

type Tone = "idle" | "busy" | "pass" | "warn" | "block";

interface Stage {
  key: string;
  kicker: string;
  title: string;
  detail: string;
  tone: Tone;
  door?: "open" | "shut";
}

const rows = (r: AskResponse) => r.spans.length;
const masked = (r: AskResponse) =>
  Object.values(r.redactions).reduce((a, b) => a + b, 0);

function stages(result: AskResponse | null, busy: boolean): Stage[] {
  if (busy || !result) {
    const tone: Tone = busy ? "busy" : "idle";
    return [
      { key: "in", kicker: "Input", title: "Your document", detail: busy ? "reading…" : "not yet read", tone },
      { key: "g1", kicker: "Outer door", title: "Gate 1 · Redact", detail: busy ? "masking…" : "idle", tone, door: busy ? "shut" : "open" },
      { key: "ai", kicker: "Chamber", title: "Model", detail: busy ? "thinking…" : "idle", tone },
      { key: "g2", kicker: "Inner door", title: "Gate 2 · Verify", detail: busy ? "checking…" : "idle", tone, door: "shut" },
      { key: "out", kicker: "Output", title: "Answer", detail: busy ? "held" : "none yet", tone },
    ];
  }

  const blocked = result.injectionFlagged;
  const verified = result.verdict === "VERIFIED";
  const noRecording = result.code === "NO_RECORDING";

  return [
    {
      key: "in",
      kicker: "Input",
      title: "Your document",
      detail: `${rows(result)} rows read`,
      tone: "pass",
    },
    {
      key: "g1",
      kicker: "Outer door",
      title: "Gate 1 · Redact",
      detail: masked(result) === 0 ? "nothing sensitive found" : `${masked(result)} values masked`,
      tone: "pass",
      door: "shut",
    },
    {
      key: "ai",
      kicker: "Chamber",
      title: "Model",
      detail: blocked
        ? "never opened"
        : result.replayed
          ? "recorded plan replayed"
          : noRecording
            ? "no recording matched"
            : (result.model ?? "unavailable"),
      tone: blocked ? "block" : result.replayed || noRecording ? "warn" : "pass",
    },
    {
      key: "g2",
      kicker: "Inner door",
      title: "Gate 2 · Verify",
      detail: verified
        ? `${result.sources?.length ?? 0} sources recomputed`
        : blocked
          ? "input refused"
          : "no proof accepted",
      tone: verified ? "pass" : blocked ? "block" : "warn",
      door: verified ? "open" : "shut",
    },
    {
      key: "out",
      kicker: "Output",
      title: verified ? "Answer released" : "Answer withheld",
      detail: verified ? formatValue(result.value) : "no figure produced",
      tone: verified ? "pass" : blocked ? "block" : "warn",
    },
  ];
}

export default function Airlock({
  result,
  busy,
}: {
  result: AskResponse | null;
  busy: boolean;
}) {
  const list = stages(result, busy);

  return (
    <section className="airlock" aria-label="Request pipeline">
      <ol className="chain">
        {list.map((s, i) => (
          <li key={s.key} className={`stage tone-${s.tone}`}>
            {i > 0 && <span className="link" aria-hidden="true" />}
            <div className={`node${s.door ? ` door door-${s.door}` : ""}`}>
              <span className="kicker">{s.kicker}</span>
              <strong>{s.title}</strong>
              <span className="detail">{s.detail}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="airlock-note">
        Both doors are never open at once. Gate 1 is a code path that runs before any
        model call exists; Gate 2 recomputes every figure from your own document.
      </p>
    </section>
  );
}

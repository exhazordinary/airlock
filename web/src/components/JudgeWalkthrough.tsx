import { SCENARIOS } from "../demo";
import type { Scenario } from "../demo";
import type { AskResponse } from "../types";

const STEPS = [
  {
    key: "sum",
    title: "Add up deductions",
    detail: "See every amount traced to the payslip.",
  },
  {
    key: "chain",
    title: "Check a percentage",
    detail: "Watch two verified calculations connect.",
  },
  {
    key: "injection",
    title: "Block a hidden instruction",
    detail: "See the model call stopped before it starts.",
  },
  {
    key: "absent",
    title: "Refuse an unsupported answer",
    detail: "See AIRLOCK withhold what it cannot prove.",
  },
] as const;

const findScenario = (key: string): Scenario | undefined =>
  SCENARIOS.find((scenario) => scenario.key === key);

const outcome = (result: AskResponse | null, stale: boolean): string => {
  if (!result || stale) return "Ready to run";
  if (result.verdict === "VERIFIED") return "Proof ready";
  if (result.injectionFlagged) return "Blocked safely";
  return "Withheld safely";
};

export default function JudgeWalkthrough({
  activeKey,
  result,
  stale,
  onSelect,
  onDismiss,
}: {
  activeKey: string;
  result: AskResponse | null;
  stale: boolean;
  onSelect: (scenario: Scenario) => void;
  onDismiss: () => void;
}) {
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.key === activeKey));

  return (
    <section className="walkthrough" aria-labelledby="walkthrough-title">
      <header className="walkthrough-head">
        <div>
          <p className="walkthrough-label">Judge walkthrough</p>
          <h2 id="walkthrough-title">See four proofs in two minutes</h2>
          <p>Each step uses the real document, gates, and receipt.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close judge walkthrough"
          onClick={onDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="walkthrough-progress">
        <span>Step {activeIndex + 1} of {STEPS.length}</span>
        <span className="walkthrough-outcome">{outcome(result, stale)}</span>
      </div>

      <ol className="walkthrough-steps">
        {STEPS.map((step, index) => {
          const active = step.key === activeKey;
          const scenario = findScenario(step.key);
          return (
            <li key={step.key}>
              <button
                type="button"
                className={active ? "walkthrough-step active" : "walkthrough-step"}
                aria-current={active ? "step" : undefined}
                onClick={() => scenario && onSelect(scenario)}
              >
                <span className="step-number" aria-hidden="true">{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

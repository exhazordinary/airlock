import type { Scenario } from "../demo";

export default function ScenarioPicker({
  scenarios,
  activeKey,
  onSelect,
}: {
  scenarios: Scenario[];
  activeKey: string;
  onSelect: (scenario: Scenario) => void;
}) {
  return (
    <section className="examples" aria-labelledby="examples-title">
      <div className="section-heading">
        <div>
          <h2 id="examples-title">Try an example</h2>
          <p>Start with a prepared document or paste your own below.</p>
        </div>
      </div>
      <nav className="scenarios" aria-label="Example documents">
        {scenarios.map((scenario) => {
          const active = scenario.key === activeKey;
          return (
            <button
              key={scenario.key}
              type="button"
              className={active ? "scenario active" : "scenario"}
              aria-pressed={active}
              onClick={() => onSelect(scenario)}
            >
              <strong>{scenario.label}</strong>
              <span>{scenario.blurb}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}

import type { FormEvent } from "react";
import type { AskResponse } from "../types";

export default function QuestionBar({
  question,
  offline,
  busy,
  result,
  onQuestionChange,
  onOfflineChange,
  onAsk,
  suggestions = [],
}: {
  question: string;
  offline: boolean;
  busy: boolean;
  result: AskResponse | null;
  onQuestionChange: (question: string) => void;
  onOfflineChange: (offline: boolean) => void;
  onAsk: () => void;
  suggestions?: string[];
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy) onAsk();
  };

  return (
    <form className="question-area" onSubmit={submit}>
      {suggestions.length > 0 && <div className="suggested-questions" aria-label="Suggested questions">
        <span className="field-label">Choose a question, or write your own</span>
        {suggestions.map((suggestion) => <button key={suggestion} type="button" className="quiet-button" disabled={busy} onClick={() => onQuestionChange(suggestion)}>{suggestion}</button>)}
      </div>}
      <label className="field-label" htmlFor="question">
        What would you like to check?
      </label>
      <div className="prompt-bar">
        <input
          id="question"
          type="text"
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
        />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Checking securely…" : "Check this answer"}
        </button>
      </div>

      <div className="question-options">
        <label className="toggle">
          <input
            type="checkbox"
            checked={offline}
            onChange={(event) => onOfflineChange(event.target.checked)}
          />
          <span>Use demo-safe mode</span>
        </label>
        {result && (
          <span className="quota">{result.quota.used} of {result.quota.limit} checks today</span>
        )}
      </div>
      <p className="mode-note">
        <strong>Demo safety net.</strong> A recorded Gemini plan avoids quota surprises;
        both privacy and proof checks still run live.
      </p>
    </form>
  );
}

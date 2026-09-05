import type { Source, TraceStep } from "../types";
import { formatValue } from "../format";
import { TRACE_SYMBOL } from "./receiptText";

const Working = ({ trace }: { trace: TraceStep[] }) => (
  <ol className="working">
    {trace.map((step) => (
      <li key={step.id} className="step">
        <div className="step-head">
          <span className="tag">{step.id}</span>
          <span className="op">{step.op}</span>
        </div>
        <table className="tally">
          <tbody>
            {step.operands.map((operand, index) => (
              <tr key={`${operand.ref}-${index}`}>
                <td className="sign">{index === 0 ? "" : TRACE_SYMBOL[step.op]}</td>
                <td className="name">
                  {operand.label ?? operand.ref}
                  {operand.kind !== "span" && (
                    <span className={`origin ${operand.kind}`}>{operand.kind}</span>
                  )}
                </td>
                <td className="num">{operand.text}</td>
              </tr>
            ))}
            <tr className="total">
              <td className="sign">=</td>
              <td className="name">{step.id}</td>
              <td className="num">{formatValue(step.value)}</td>
            </tr>
          </tbody>
        </table>
      </li>
    ))}
  </ol>
);

const SourceCards = ({ sources, onLocateSource }: { sources: Source[]; onLocateSource?: (id: string) => void }) => (
  <ul className="sources">
    {sources.map((source) => (
      <li key={source.id}>
        <span className="tag">{source.id}</span>
        <span className="name">{source.label ?? "Unlabelled line"}</span>
        <span className="num">{source.text}</span>
        {onLocateSource && <button type="button" className="quiet-button source-location" onClick={() => onLocateSource(source.id)}>Show {source.label ?? source.id} in PDF</button>}
      </li>
    ))}
  </ul>
);

export default function ReceiptProof({
  trace,
  sources,
  onLocateSource,
}: {
  trace: TraceStep[];
  sources: Source[];
  onLocateSource?: (id: string) => void;
}) {
  return (
    <>
      {trace.length > 0 && (
        <section className="block">
          <h3>How the answer was calculated</h3>
          <Working trace={trace} />
        </section>
      )}
      {sources.length > 0 && (
        <section className="block">
          <h3>Source lines used</h3>
          <SourceCards sources={sources} onLocateSource={onLocateSource} />
          {trace.length === 0 && (
            <p className="hint">Read directly from the document. No calculation was needed.</p>
          )}
        </section>
      )}
    </>
  );
}

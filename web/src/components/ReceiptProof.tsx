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

const SourceCards = ({ sources }: { sources: Source[] }) => (
  <ul className="sources">
    {sources.map((source) => (
      <li key={source.id}>
        <span className="tag">{source.id}</span>
        <span className="name">{source.label ?? "Unlabelled line"}</span>
        <span className="num">{source.text}</span>
      </li>
    ))}
  </ul>
);

export default function ReceiptProof({
  trace,
  sources,
}: {
  trace: TraceStep[];
  sources: Source[];
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
          <SourceCards sources={sources} />
          {trace.length === 0 && (
            <p className="hint">Read directly from the document. No calculation was needed.</p>
          )}
        </section>
      )}
    </>
  );
}

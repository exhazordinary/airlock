import { useState } from "react";
import type { PublicSpan } from "../types";

const SpanTable = ({ spans, cited }: { spans: PublicSpan[]; cited: Set<string> }) => (
  <table className="spans">
    <caption className="sr-only">Every line of your document as the model received it</caption>
    <thead>
      <tr>
        <th scope="col">Line</th>
        <th scope="col">Document field</th>
        <th scope="col">What AI received</th>
      </tr>
    </thead>
    <tbody>
      {spans.map((span) => (
        <tr
          key={span.id}
          className={`${span.redacted ? "masked" : ""} ${cited.has(span.id) ? "cited" : ""}`.trim()}
        >
          <td className="tag">{span.id}</td>
          <td className="name">{span.label ?? <em>Unlabelled</em>}</td>
          <td className="num">
            {span.redacted ? (
              <span className="lock" title={`${span.redactionType} protected before AI`}>
                🔒 {span.text}
              </span>
            ) : span.text}
            {cited.has(span.id) && <span className="used">used</span>}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export default function ReceiptDisclosure({
  spans,
  citedSpans,
  modelSaw,
}: {
  spans: PublicSpan[];
  citedSpans: string[];
  modelSaw: string;
}) {
  const [open, setOpen] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const protectedLines = spans.filter((span) => span.redacted).length;
  const cited = new Set(citedSpans);

  return (
    <section className="block">
      <button className="disclose" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} See exactly what AI received
        {" — "}{spans.length} lines, {protectedLines} protected
      </button>
      {open && (
        <>
          <SpanTable spans={spans} cited={cited} />
          <button
            className="disclose"
            aria-expanded={showRequest}
            onClick={() => setShowRequest(!showRequest)}
          >
            {showRequest ? "▾" : "▸"} See the complete AI request
          </button>
          {showRequest && <pre>{modelSaw}</pre>}
        </>
      )}
    </section>
  );
}

export default function SignedOut({
  onSignIn,
  error,
}: {
  onSignIn: () => void;
  error: string;
}) {
  return (
    <main className="signed-out">
      <section className="welcome-copy">
        <a className="wordmark" href="/" aria-label="AIRLOCK home">AIRLOCK</a>
        <p className="academy">Google Cloud Gen AI Academy APAC</p>
        <h1>Check the answer. Keep the proof.</h1>
        <p className="welcome-lede">
          Ask about a payslip, bill, or invoice. AIRLOCK hides personal details before
          AI sees the document, then proves every figure before showing it to you.
        </p>
        <button className="primary sign-in" type="button" onClick={onSignIn}>
          Continue with Google
        </button>
        <p className="sign-in-note">Your private workspace and receipt history stay tied to your account.</p>
        {error && <p className="err" role="alert">{error}</p>}

        <ul className="welcome-promises">
          <li><span aria-hidden="true">1</span><strong>Personal details are masked</strong> before any AI call.</li>
          <li><span aria-hidden="true">2</span><strong>Every figure is recalculated</strong> from cited document lines.</li>
          <li><span aria-hidden="true">3</span><strong>Every check leaves a receipt</strong> you can inspect and copy.</li>
        </ul>
      </section>

      <aside className="sample-receipt" aria-label="Example verified receipt">
        <header>
          <div>
            <p>Sample receipt</p>
            <span>Household paperwork check</span>
          </div>
          <span className="sample-seal">Verified</span>
        </header>
        <p className="sample-question">How much was deducted from gross pay?</p>
        <p className="sample-value">961.55</p>
        <div className="sample-working" aria-label="Verified calculation">
          <span>EPF employee</span><strong>624.80</strong>
          <span>SOCSO</span><strong>24.75</strong>
          <span>PCB tax</span><strong>312.00</strong>
          <span className="sample-total">Verified total</span><strong className="sample-total">961.55</strong>
        </div>
        <ul className="sample-checks">
          <li><span aria-hidden="true">✓</span> 6 personal details protected</li>
          <li><span aria-hidden="true">✓</span> 3 source lines checked</li>
          <li><span aria-hidden="true">✓</span> Receipt saved by the server</li>
        </ul>
        <footer>Nothing sensitive goes in. Nothing unproven comes out.</footer>
      </aside>
    </main>
  );
}

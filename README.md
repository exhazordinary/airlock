# AIRLOCK

**An AI that hands you a receipt for every answer.**

A private assistant for household paperwork — payslips, utility bills, tenancy
agreements, insurance letters. Sign in with Google, add a document, ask questions
about it.

An airlock is a two-door chamber where both doors are never open at once. That is the
architecture, not a metaphor. Two deterministic gates flank the model:
**nothing sensitive goes in, nothing unproven comes out.**

> Built for the Google Cloud Gen AI Academy APAC Cohort 3 Ideathon.
> All sample data in this repository is synthetic.

**[Open the live Cloud Run app](https://airlock-x5bsmjxusa-as.a.run.app)** ·
**[View the public source](https://github.com/exhazordinary/airlock)**

![The AIRLOCK judge walkthrough, document workspace, and proof receipt](docs/hero.png)

## The two-minute walkthrough

The signed-in workspace opens with four judge-ready checks. Each one loads a real
synthetic document into the same input, gates, evaluator, receipt, and Firestore path
used for any other question:

1. **Add up deductions** — trace three payslip rows into one verified total.
2. **Check a percentage** — follow a two-step calculation with an allowlisted constant.
3. **Block a hidden instruction** — prove Gate 1 stopped the model call before it began.
4. **Refuse an unsupported answer** — see AIRLOCK produce no figure when proof is absent.

The walkthrough can be dismissed and reopened. It is navigation through the product,
not a separate demo surface.

## Beyond the starter lab

### Bring your own document

Upload a text-based PDF or UTF-8 TXT file, review and correct the extracted text,
then choose **Use this document**. Suggested questions help you start without
writing a prompt. You can still paste or edit text directly.

The original PDF appears beside a list of extracted rows. Select a row to open its
page and highlight its location, or use **Show … in PDF** on a fresh receipt's source
cards. Highlights identify approximate extraction locations, not transcription
accuracy. Editing the document disables receipt location links until it exactly
matches the extraction again. The PDF and its coordinates remain in browser memory;
they are not stored with the receipt and disappear on reload or sign-out.

For a complete judge upload test, [download the synthetic sample payslip](web/public/samples/airlock-demo-payslip.pdf),
upload it, select an extracted row, accept the text, then check the EPF percentage.
The expected verified result is **11%**. Select **Show EPF Employee in PDF** to trace
the receipt back to the original page. The app includes the same download link.
Regenerate the sample with `node scripts/create-demo-pdf.mjs`.

PDF.js extracts text locally in the browser with a bundled worker. The original
file is not uploaded or saved. Only the reviewed document text is sent to the
existing authenticated API when you request a check; Gate 1 still runs before
Gemini. Importing a document selects live mode instead of a recorded demo plan.

Limits: 10 MB, 20 PDF pages, and 20,000 extracted characters. Password-protected,
scanned, unreadable, and oversized documents produce an actionable error. Check
column order and label/value pairs against the original before continuing:
extraction is not proof of transcription accuracy. Photos and OCR are not supported.

### What changed

The codelab's authenticated journal proved the four required services could work
together. AIRLOCK keeps that foundation, then changes the trust model rather than
adding another chatbot feature:

| Starter pattern | AIRLOCK extension |
|---|---|
| Gemini writes an answer | Gemini can write only a number-free computation plan; the server calculates the answer |
| A prompt asks the model to handle data safely | Gate 1 masks Malaysian PII in code, with a provider-layer `assertClean` backstop |
| History stores messages | Firestore stores immutable, server-written proof receipts under the authenticated UID |
| A demo depends on live model quota | Recorded plans replace only Gemini; both deterministic gates still run against the current document |
| Errors are generic failures | Refusals explain what could not be proven while rendering no unverified figure |

The checked-in [Google AI Studio Custom Instructions](CUSTOM_INSTRUCTIONS.md) supplied
the five-zone threat lens, secure Firebase boundaries, Secret Manager rule, fallback
expectations, and testable walkthrough requirements used during development. The
repository's threat model, tests, commit history, and deployed behavior show how those
instructions became implementation rather than prompt-only claims.

---

## The receipt

Ask *"how much was deducted from my gross pay in total?"* and you do not get a number
you have to trust. You get the working.

![A verified receipt showing the equation, its operands and the cited rows](docs/receipt.png)

Every operand names the document row it came from. Chain two steps and the receipt says
so, marking which values are earlier results and which are allowlisted constants rather
than figures from your page.

![A chained calculation using a step result and an allowed constant](docs/chained.png)

Hide a hostile instruction in the document and the inner door never opens. The receipt
shows every row exactly as the model would have received it — masked values as their
tokens — and the pipeline records that the model was never called.

![An injection attempt blocked before the model, with the redacted rows listed](docs/injection.png)

---

## What makes it different

Most AI document tools ask the model to be careful. AIRLOCK removes the model's
ability to be careless.

### Gate 1 — Redaction (inbound)

Malaysian PII is masked to stable tokens (`[NRIC_1]`, `[ACCT_1]`) by a deterministic
pass that runs **before a Gemini call exists in the code path**. Two rule families:

- **Pattern rules** over span text — NRIC (validated against a real birth date, not a
  bare 12-digit run), Malaysian phone numbers, bank accounts, email.
- **Label rules** over column and row headers — in a table the header already declares
  the column's type, so no NER model is needed to infer what the schema states.

Two guards that are easy to get wrong and are covered by tests:

- A span flagged as a computed total is never masked. Masking one silently turns a
  verifiable figure into a redacted one.
- The account label rule demands an explicit number-word (`account no`, not `account`).
  Financial prose is full of the word "accounts"; a row labelled *"Total per audited
  accounts"* must survive intact.

`assertClean(payload)` is the last line of defence, called in the provider layer
immediately before bytes leave the process. If Gate 1 did its job it never fires, which
is exactly why it is cheap to keep — and it makes the guarantee structural rather than a
prompt instruction.

The UI exposes this directly. Every receipt lists **each row exactly as the model
received it**, with masked values shown as their token, and can print the exact bytes
sent upstream.

### Gate 2 — Computation (outbound)

Gemini is never asked for a figure. It returns a flat computation plan, constrained by
`responseSchema`:

```json
{ "answer_template": "The verified amount is {{v}}.",
  "steps": [ { "id": "t1", "op": "sum", "args": ["s10", "s11", "s12"] } ],
  "result": "t1",
  "cited_spans": ["s10", "s11", "s12"] }
```

**The schema has no literal node type.** Only span references and a small allowlisted
constant enum for unit conversion and counting. "The model cannot state a number" is
therefore a property of the grammar it generates *within*, not a check applied after the
fact. A deterministic evaluator resolves the ordered steps against the document's spans:

- resolves, and every span it used was cited → green **VERIFIED**
- unknown span, redacted span, division by zero, wrong arity, excessive depth, or a span
  used but not cited → amber **CANNOT VERIFY**, with a reason and a machine-readable code

No code is generated and none is executed, so there is no sandbox to escape.

### The receipt

A verdict alone is an assertion. Gate 2 therefore returns its **working**, and the UI
renders it as a tally you can audit line by line:

```
t1  sum
    EPF Employee        624.80
  + SOCSO                24.75
  + PCB Tax             312.00
  = t1                  961.55
```

Every operand carries the row label it came from, the ids of any earlier steps it
reuses, and a marker when it is one of the allowlisted constants rather than a document
figure. Alongside it the receipt lists the cited source rows, the Gate 1 ledger, the
latency, the model that answered, and the server-written receipt id. The whole thing
exports as plain text, so the proof survives leaving the page.

### Demo-safe mode

Gemini's free tier is metered per project **per model** and has been observed as low as
20 requests a day. A walkthrough that depends on live quota is a walkthrough that can
fail in front of an audience.

The UI calls this **demo-safe mode**. It substitutes **only the model**, replaying a
plan captured from a real Gemini run, addressed by row label rather than span id, and
then runs it through Gate 2
against the document actually on screen. Both gates still run live: edit a figure and
the answer is recomputed, not repeated; ask something with no recording and it refuses
rather than inventing one. The same path is the automatic fallback when the provider is
exhausted, and any answer produced this way is labelled `recorded plan` on its receipt.

### Previous checks (Trust Ledger)

Every interaction writes an audit record under the user's UID: redactions applied, the
exact payload the model saw, which model answered, the verdict, latency, and whether a
prompt-injection attempt was detected.

Receipts are written **only** by the backend through the Admin SDK. Firestore rules set
`allow write: if false` on that path, so a user can read their own audit trail but
cannot forge one.

---

## How the required technologies are used

| Technology | Role in AIRLOCK |
|---|---|
| **Firebase Authentication** | Google Sign-In, no passwords handled. The UID is the isolation key for every Firestore path and the identity for the per-user rate limiter. Every API request carries an ID token, verified server-side with `firebase-admin` before any work begins. |
| **Cloud Firestore** | User-partitioned storage for documents, the Trust Ledger, and the daily quota bucket. Security rules enforce owner-bound reads and deny all client writes to receipts and quota. |
| **Cloud Run** | Hosts a single container serving both the built React app and the API, so there is one URL and no CORS surface. Scales to zero, capped at 3 instances as an abuse ceiling on a public LLM endpoint. |
| **Gemini API (AI Studio)** | Powers extraction and reasoning, constrained by `responseSchema` to emit only a flat computation plan. The key is fetched from Secret Manager at runtime and never reaches a client. A model ladder steps down on quota exhaustion. |

---

## Threat model

Mapped to the five zones from the challenge's Custom Instructions framework.

| Zone | Threat | Mitigation |
|---|---|---|
| Input Surfaces | Pasted document carries NRIC, bank account, phone | Gate 1 masks before any egress; `assertClean` throws on leak |
| Input Surfaces | Prompt injection hidden in the document | Detected before the provider call; output grammar cannot express a number either way |
| Input Surfaces | Injected script or clickjacked frame | CSP, `X-Frame-Options`, `nosniff`, and a COOP that still permits the sign-in popup |
| Planning & Reasoning | Model asserts a plausible but wrong figure | Gate 2 refuses anything it cannot resolve from cited spans |
| Tool Execution | Model-authored code escapes a sandbox | No code is generated or executed at all |
| Memory & State | User A reads user B's history | Owner-bound rules; UID from a verified ID token, never from the request body |
| Memory & State | User forges a clean audit record | Receipts are `allow write: if false`; server-only via Admin SDK |
| Inter-System Communication | API key leaks to the browser | Key lives in Secret Manager, read backend-only; never serialised to a response |
| Inter-System Communication | Public endpoint drains the quota | Per-UID daily bucket and a service-wide daily budget, decided in one transaction, plus `--max-instances=3` |
| Inter-System Communication | Oversized or mistyped body burns compute | Typed validation at the edge with hard character ceilings, before the quota is charged |

### On the Firebase web API key

`web/src/firebase.ts` contains an `AIzaSy...` string, and automated secret scanners
flag it. It is not a leak, and it is worth being precise about why.

A Firebase Web API key **identifies a project; it authorises nothing**. Google states
it directly: *"API keys for Firebase services are not used to control access to backend
resources; that can only be done with Firebase Security Rules."*

It also **cannot** be hidden. The browser needs it to reach the auth endpoint, so every
Firebase web app on the internet ships it. Moving it into a `.env` and injecting it at
build time is theatre — the bundler inlines it into the JavaScript, where anyone can
read it:

```bash
curl -s https://<host>/assets/index-*.js | grep -o 'AIzaSy[A-Za-z0-9_-]*'
```

That command is worth running against this deployment. It returns exactly one string:
this key. It never returns the Gemini key, which is the real secret and stays in Secret
Manager, backend-only.

**The residual risk is real but different from "it is visible":** an *unrestricted*
Google API key can be aimed at other APIs enabled on the project. So this key is
restricted on both axes:

| Restriction | Value |
|---|---|
| HTTP referrers | the Cloud Run origin and `localhost` only |
| API targets | `identitytoolkit`, `securetoken`, `firestore`, `firebase`, `firebaseinstallations` |

Verify with:

```bash
gcloud services api-keys describe <KEY_UID> --project=<PROJECT> --format='yaml(restrictions)'
```

Deleting or rotating the key achieves nothing, because the replacement is equally
public. Restricting it is the control that actually matters.

### Dependency advisories

`npm audit --omit=dev` reports two moderate transitive advisories. Both were triaged
rather than silenced, and neither is reachable here:

| Package | Via | Why it does not apply |
|---|---|---|
| `qs` | `express@4.22.2` | The advisories concern query-string parsing. AIRLOCK exposes no query parameters — `/api/ask` and `/api/health` are the whole API, and the former reads a JSON body bounded at 256 kB. `6.15.3` is already the newest `qs` that Express 4 ships. |
| `uuid` | `firebase-admin@13` | Affects v3/v5/v6 only when a caller supplies its own `buf`. Nothing on this path does. The advised "fix" is `firebase-admin@10.3.0`, a major downgrade that would cost more than it buys. |

The web bundle reports zero vulnerabilities.

---

## Security rules

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/documents/{docId} {
      allow read, write: if isOwner(userId);
    }

    match /users/{userId}/receipts/{receiptId} {
      allow read: if isOwner(userId);
      allow write: if false;
    }

    match /users/{userId}/quota/{quotaId} {
      allow read: if isOwner(userId);
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Reproducing this deployment

Requires `gcloud`, `firebase-tools`, and Node 22+.

```bash
PROJECT=your-project-id
REGION=asia-southeast1

# 1. Project and APIs
gcloud projects create "$PROJECT"
gcloud billing projects link "$PROJECT" --billing-account=YOUR_BILLING_ACCOUNT
gcloud services enable run.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com identitytoolkit.googleapis.com \
  firebase.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com --project="$PROJECT"

# 2. Firestore
gcloud firestore databases create --location="$REGION" \
  --type=firestore-native --project="$PROJECT"

# 3. Firebase + Google Sign-In
firebase projects:addfirebase "$PROJECT"
firebase apps:create WEB "AIRLOCK Web" --project "$PROJECT"
firebase apps:sdkconfig WEB <appId> --project "$PROJECT"   # paste into web/src/firebase.ts
# Enable Google in the console: Authentication -> Sign-in method -> Google

# 4. Gemini key into Secret Manager
printf '%s' 'YOUR_AI_STUDIO_KEY' | gcloud secrets create GEMINI_API_KEY \
  --data-file=- --replication-policy=automatic --project="$PROJECT"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor --project="$PROJECT"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/datastore.user

# 5. Rules
firebase deploy --only firestore:rules --project "$PROJECT"

# 6. Deploy. The label is required for challenge verification.
gcloud run deploy airlock --source . --region="$REGION" --project="$PROJECT" \
  --allow-unauthenticated --min-instances=0 --max-instances=3 --memory=512Mi \
  --set-env-vars='^@^GEMINI_MODELS=gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-3.1-flash-lite' \
  --labels=dev-tutorial=cloud-run-ai-challenge

# 7. Authorize the Cloud Run domain for Firebase Auth.
# Firebase only auto-authorizes *.firebaseapp.com and *.web.app, so signInWithPopup
# fails with auth/unauthorized-domain from a *.run.app origin until you add it.
RUN_DOMAIN=$(gcloud run services describe airlock --region="$REGION" \
  --project="$PROJECT" --format='value(status.url)' | sed 's#https://##')

curl -s -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -H "X-Goog-User-Project: $PROJECT" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config?updateMask=authorizedDomains" \
  -d "{\"authorizedDomains\":[\"localhost\",\"$PROJECT.firebaseapp.com\",\"$PROJECT.web.app\",\"$RUN_DOMAIN\"]}"
```

The allowlist is on the domain *initiating* the OAuth flow. It is what stops a cloned
frontend on someone else's domain from harvesting sign-ins against this project.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_MODELS` | required | Comma-separated model ladder, newest first. Free-tier quota is per project **per model**, so each rung is a separate budget. |
| `GEMINI_ATTEMPT_TIMEOUT_MS` | `12000` | Maximum time for one model attempt |
| `GEMINI_TOTAL_TIMEOUT_MS` | `45000` | Maximum time across the full ladder |
| `DAILY_LIMIT` | `25` | Questions per user per day |
| `GLOBAL_DAILY_LIMIT` | `300` | Questions across the whole service per day. Checked in the same transaction as the per-user bucket, so a rejected request never charges the caller. |
| `GEMINI_API_KEY` | unset | Local development only. In production the key is read from Secret Manager. |

### Local development

```bash
cd server && npm install && npm run dev     # :8080
cd web    && npm install && npm run dev     # :5173, proxies /api
```

---

## Testing

Both gates are built test-first. The suites are the argument that the guarantees are
structural rather than aspirational, so they assert behaviour a reader would want
proven, not implementation detail.

| Suite | Covers |
|---|---|
| `gates/redact` | NRIC, phone, account, email, address and name masked in one payload; totals never masked; `assertClean` throws when redaction is deliberately bypassed |
| `gates/compute` | The schema exposes no numeric type; bare numbers and unlisted constants rejected; forward references, duplicate step ids and wrong arity refused |
| `gates/trace` | Each step renders as an equation with labelled operands; constants and step reuse are marked as such; every refusal carries its code |
| `spans` | Ambiguous numeric spans are rejected rather than guessed |
| `replay` | A recording verifies through Gate 2 against the live document, recomputes an edited figure, and returns nothing when its rows are absent |
| `gemini` | SDK retries, per-attempt and total latency bounded; provider errors sanitised before they reach a caller |
| `app` | Anonymous and forged tokens rejected; malformed and oversized bodies refused before quota is charged; injection blocked before the provider; Gate 1 holds on the wire; security headers present |
| `rules` | User B cannot read or list user A's receipts; nobody can create, rewrite or delete one from a client; the service budget is invisible to clients |
| `components` | The judge walkthrough selects real scenarios; a refusal renders no figure at all; masked rows show their token and never the original; a stale receipt says so; loading, ledger and signed-out states stay understandable |

```bash
cd server && npm test                        # gates, provider, replay, routes, errors
cd web    && npm test                        # receipt, pipeline and ledger rendering
JAVA_HOME=$(/usr/libexec/java_home -v 21+) \
  firebase emulators:exec --only firestore 'vitest run'   # firestore.rules
```

The component suite asserts the claim the product is named for: on any refusal the UI
must render **no figure at all**, not a greyed-out or crossed-through one.

---

## Layout

```
server/src/gates/redact.ts       Gate 1 — pattern and label rules, assertClean
server/src/gates/compute.ts      Gate 2 — schema with no literal node, evaluator, trace
server/src/replay.ts             Recorded plans, bound by row label not span id
server/src/gemini.ts             Provider, model ladder, injection detection
server/src/app.ts                Routes and the request pipeline
server/src/validate.ts           Typed edge validation and size ceilings
server/src/security.ts           CSP and the rest of the header policy
server/src/auth.ts               Firebase ID-token middleware
server/src/ratelimit.ts          Per-UID and service-wide daily budgets
server/src/receipts.ts           Trust Ledger writer, Admin SDK only
server/src/spans.ts              Document text into labelled spans
web/src/App.tsx                  Auth, API state, receipt subscription
web/src/components/Workspace.tsx Judge walkthrough and signed-in layout
web/src/components/Airlock.tsx   The two-door pipeline, live per request
web/src/components/Receipt.tsx   Verified or withheld receipt shell
web/src/components/ReceiptProof.tsx Working and cited source rows
web/src/components/ReceiptDisclosure.tsx Redacted model input disclosure
web/src/components/Ledger.tsx    Previous checks, expandable per receipt
firestore.rules                  Owner-bound access, server-only writes
CUSTOM_INSTRUCTIONS.md           AI Studio Custom Instructions used to build this
```

## Licence

MIT

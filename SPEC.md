# AIRLOCK

**An AI that hands you a receipt for every answer.**

Gen AI Academy APAC Cohort 3 — Ideathon submission.

An airlock is a two-door chamber where both doors are never open at once. That is the
architecture, not a metaphor. Two deterministic gates flank the model: nothing sensitive
goes in, nothing unproven comes out.

---

## 1. What it is

A private assistant for household paperwork — payslips, utility bills, tenancy
agreements, insurance letters, medical bills. Sign in with Google, add a document,
ask questions about it.

It keeps the starter journal app's skeleton exactly:
`auth -> private dashboard -> Gemini question -> save receipt to Firestore -> history`.
Every base component is retained and load-bearing. What changed is *what* you journal
(paperwork, not feelings) and that history gained a purpose: the Trust Ledger.

## 2. Why it scores

The rubric is **Authenticity, Usability, Stability, Security**. No impact or business
line item — this is a craft rubric.

| Criterion | How AIRLOCK scores |
|---|---|
| Authenticity | Glass-box AI with deterministic gates, not a codelab fork |
| Security | Security is the visible product surface, demoed live |
| Stability | Gates degrade to "cannot verify", never to a wrong answer |
| Usability | The "what the model actually saw" reveal is the hook |

---

## 3. Gate 1 — Redaction (inbound)

Deterministic, server-side, running before the Gemini call exists in the code path.
Malaysian PII is masked to stable tokens and un-masked locally on return.

| Entity | Token |
|---|---|
| NRIC, date-validated (not a bare 12-digit run) | `[NRIC_n]` |
| MY phone, mobile and landline, with or without country code | `[PHONE_n]` |
| Bank account, context-gated | `[ACCT_n]` |
| Email | `[EMAIL_n]` |
| Address / postcode | `[ADDR_n]` |
| Person name, label-driven | `[NAME_n]` |

Two rule families:
- **Pattern rules** over span text. Works on any document.
- **Label rules** over column and row headers. In a table the header already declares
  the column's type, so no NER model is needed to infer what the schema states.

Two guards that are easy to get wrong:
- Never mask a span flagged as a computed total. Masking one silently turns
  verification into "not applicable".
- Label rules must require an explicit number-word (`account no`, not `account`).
  Financial prose is full of the word "accounts"; a row labelled "Total per audited
  accounts" must not be masked.

`assertClean(payload)` is the last line of defence, called in the provider layer
immediately before bytes leave the process. If Gate 1 did its job it never fires,
which is exactly why it is cheap to keep — and it makes the guarantee structural
rather than a prompt instruction.

**UI:** a per-message toggle, *"what you gave"* against *"what the model saw"*.

## 4. Gate 2 — Computation (outbound)

Gemini is never asked for a figure. It returns a flat computation plan, constrained by
`responseSchema`:

```json
{ "answer_template": "The verified amount is {{v}}.",
  "steps": [ { "id": "t1", "op": "subtract", "args": ["s3", "s7"] } ],
  "result": "t1",
  "cited_spans": ["s3", "s7"] }
```

**The schema has no literal node type.** Only span references and a small allowlisted
constant enum for unit conversion and counting. "The model cannot state a number" is
therefore a property of the grammar it generates within, not a check applied after the
fact. A deterministic evaluator resolves ordered steps against spans extracted from the source.

- resolves with complete citations -> green **VERIFIED**, cited span IDs shown
- unknown span, malformed plan, or unsafe output -> amber **CANNOT VERIFY** with the reason

No code is generated and none is executed.

## 5. Trust Ledger

One server-written audit record per interaction, under the user's UID: redactions
applied, model used, verdict, latency, and injection flags. Surfaced as a
"Receipts" tab.

Client writes are denied by security rules. A user can read their receipts; they
cannot forge one.

---

## 6. Architecture

One Cloud Run service serves the built React app and the API. One URL, no CORS,
one deploy.

```
Browser --Firebase Auth (Google Sign-In)--> ID token
   |
   +--> Cloud Run  [asia-southeast1, min=0, max=3]
          |- verify ID token on EVERY request (firebase-admin)
          |- per-UID rate limit (Firestore token bucket)
          |- GATE 1: REDACTION      -> PII masked to stable tokens
          |- assertClean(payload)   -> throws if anything unmasked would leave
          |- Gemini (key via Secret Manager, never leaves the backend)
          |- GATE 2: COMPUTATION    -> tree evaluated deterministically
          +- write receipt          -> users/{uid}/receipts/{id}
```

Vite + React + TypeScript · Express + TypeScript · firebase-admin ·
@google-cloud/secret-manager · @google/genai · vitest · multi-stage Dockerfile.

### Firestore

```
users/{uid}/documents/{docId}   owner-bound read/write
users/{uid}/receipts/{id}       owner-bound READ, client write DENIED
users/{uid}/quota/current       client read-only, server-written
```

---

## 7. Environment

| | |
|---|---|
| GCP project | `airlock-ideathon` (number `285164197878`) |
| Region | `asia-southeast1` |
| Firestore | `(default)`, native mode |
| Secret | `GEMINI_API_KEY` in Secret Manager |
| Cloud Run label | `dev-tutorial=cloud-run-ai-challenge` — required for verification |
| Budget | RM20 with alerts at 25/50/90/100 percent |
| Repo | `git@github.com:exhazordinary/airlock.git` |

Deploy flags: `--min-instances=0 --max-instances=3 --region=asia-southeast1`.

## 8. Known constraint

Gemini free-tier quota is metered per project **per model**, observed as low as 20
requests per day. A second model is a second budget, so the provider ladders
`gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash ->
gemini-3-flash-preview -> gemini-3.1-flash-lite`
and steps down on exhaustion. Each attempt and the full ladder have server-side timeouts;
the UI fails closed with CANNOT VERIFY when live quota is unavailable.

## 9. Deliverables

- [x] Cloud Run service labelled `dev-tutorial=cloud-run-ai-challenge`
- [x] Public working Cloud Run URL
- [x] Public repo with frontend, backend, README, `firestore.rules`, reproduction config
- [ ] Social post carrying `#AccelerateAIwithCloudRun`
- [ ] Brief description naming Firebase Auth, Firestore, Cloud Run and Gemini
- [ ] All fields in the Ideathon Prototype Submission tab

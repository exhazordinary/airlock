# Custom Instructions — Google AI Studio

These are the Custom Instructions used in Google AI Studio while generating and
extending AIRLOCK. Per the challenge briefing, they were expanded every time a new
integration was added, so generated code stayed production-grade as the surface grew.

---

## 1. Agentic threat modelling

Before generating code, reason across all five zones and state the mitigation for each:

| Zone | Concern in AIRLOCK |
|---|---|
| Input Surfaces | Pasted documents are untrusted. They may carry PII and prompt injection. |
| Planning & Reasoning | The model may assert figures it cannot support. |
| Tool Execution | No code is generated or executed. Only a constrained tree is evaluated. |
| Memory & State | Firestore is user-partitioned by UID. Receipts are append-only. |
| Inter-System Communication | Nothing unmasked may leave the process toward the Gemini API. |

## 2. Secure coding standards

- Validate and bound every input. Cap request bodies at 1 MB.
- Treat every model response as untrusted input. Parse defensively; never trust shape.
- Prompt-injection defence is structural, not textual: the model's output grammar
  cannot express a raw number, so a persuaded model still cannot fabricate a figure.
- Encode all output. Never render model text as HTML.
- Fail closed. On any doubt return CANNOT VERIFY rather than a plausible answer.

## 3. Firestore and Firebase rules

- Every document path is owner-bound: `request.auth.uid == userId`.
- Receipts and quota are server-written only: `allow write: if false`. The backend
  reaches them through the Admin SDK, which bypasses rules by design.
- A catch-all `match /{document=**} { allow read, write: if false; }` denies anything
  not explicitly granted.
- Prefer federated sign-in. Never store or handle passwords.

## 4. Secret management

- Never hardcode an API key. Reject any output resembling `const API_KEY = "AIzaSy..."`.
- Never hardcode a model id. Read the model ladder from configuration.
- Retrieve the Gemini key through the Secret Manager client at runtime. The environment
  variable path exists only for local development.
- The Firebase web config is public by design and is not a secret. Do not conflate it
  with the Gemini key, which is backend-only and never reaches a client.

## 5. Security reviewer persona

After generating code, re-read it as an adversary and report:
- every path data takes from user input to an external API
- any place an unmasked value could reach the network
- any client-writable path that should be server-only
- any branch that returns a number without a verification step

## 6. Functional stability and walkthroughs

- Generate test cases for every user-visible interaction, including the failure paths.
- Assume the free-tier quota is exhausted. Ladder across models, because quota is
  metered per project per model, then degrade with an honest banner.
- Never let a quota error surface as a spinner or a stack trace.

## 7. README generator

Produce deployment steps, the `firestore.rules` in full, Secret Manager IAM bindings,
and the Cloud Run verification label `dev-tutorial=cloud-run-ai-challenge`.

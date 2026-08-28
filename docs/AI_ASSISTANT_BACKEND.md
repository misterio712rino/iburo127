# AI assistant production-readiness baseline

Status: code-level foundation. This document does not claim that a real OpenAI request has been executed in staging or production.

## Trust boundary

The browser is not trusted for identity, role, case ownership, plan, feature entitlement, case context, or conversation-role authority.

`GET /api/platform/cases/:caseId/ai` returns the server-authorized, minimized AI view state without calling the model provider.

`POST /api/platform/cases/:caseId/ai`:

1. resolves the Better Auth server session;
2. maps it to the internal actor;
3. permits only `CLIENT` actors;
4. resolves the requested `ClientCase` through the existing server-side `ClientCaseService` access policy;
5. verifies that the authenticated client owns the case;
6. loads `PlanFeature` entitlements from PostgreSQL and requires `AI_ASSISTANT`;
7. reserves a PostgreSQL-backed request budget and writes a non-PII `ai.request.accepted` audit event;
8. builds a minimized case summary from PostgreSQL;
9. converts browser-supplied conversation history into an explicitly untrusted user-data block instead of forwarding browser-controlled `assistant` roles;
10. calls the model provider only after the preceding checks pass;
11. writes a non-PII completion/restricted/failure audit event.

A manager/lawyer role, an inaccessible case, a case without the feature, or a request over budget cannot reach the model provider through this client endpoint.

## Client state

The AI screen no longer uses `DemoIdentity`, demo case data or `demoAssistant` to decide access or generate responses.

Conversation state is intentionally memory-only in the browser tab. It is not written to `localStorage`. There is no server-side conversation-history persistence yet, so a page reload clears the chat.

The surrounding `PlatformShell` still has demo identity/profile dependencies and is tracked as a separate platform-wide migration blocker; server AI authorization does not trust that shell state.

## Data minimization

The external model context intentionally excludes:

- user id and AuthIdentity subject;
- name, email and phone;
- questionnaire answers;
- passport, SNILS, INN or banking fields;
- file names, object keys and file contents;
- document contents;
- task titles/descriptions;
- lawyer identity;
- internal case UUID and human-readable case number.

The context contains only plan/stage/case status, questionnaire/practicum progress counts, document taxonomy/status, aggregate task counts, ready-file count and the current user conversation supplied to the endpoint.

Users can still type personal data in their own message. The system prompt explicitly tells the assistant not to solicit unnecessary sensitive data. Final privacy notice/provider data-processing configuration remains a release gate.

## Untrusted conversation history

The browser may submit short conversation history for continuity, but its role labels are not trusted. After validation, the server serializes that history into a single `user`-role data block. A browser-provided `assistant` turn is labeled only as `previous_assistant_output` inside the serialized data and is never forwarded as a provider-level assistant-role message.

The data block explicitly states that the transcript is untrusted and cannot override system instructions or legal/data-handling restrictions. This narrows role-confusion and prompt-injection surface while keeping the current stateless UX.

## Provider boundary

The current provider transport uses the OpenAI Responses API over server-side `fetch` only:

- exact endpoint: `https://api.openai.com/v1/responses`;
- API key is read server-side from `OPENAI_API_KEY`;
- model id is explicit in `IB_AI_OPENAI_MODEL`;
- provider configuration is lazy and is not required for the read-only `GET` entitlement/view-state request;
- `store: false` is always sent for model requests;
- tools are an empty array;
- request timeout is bounded;
- output tokens are bounded;
- upstream response/error bodies are never returned to the browser;
- raw network exceptions are normalized;
- every upstream request receives an `X-Client-Request-Id`.

No OpenAI SDK dependency is required, so this foundation does not modify the dependency lockfile.

## Legal guardrails

The assistant is informational. It cannot:

- make the final legal decision for the client;
- issue a final legal opinion;
- sign documents;
- send/file documents with a court;
- conclude contracts;
- represent the client in court.

Direct requests for those actions are intercepted before the external model call. Model output is also checked for claims that the assistant already signed/sent/filed/concluded something on the user's behalf; such output is replaced with a deterministic safe response.

These deterministic checks supplement the model instructions. They are not a substitute for human legal review of high-stakes decisions.

## Request and cost controls

Per-request limits:

- message: 4,000 characters;
- history: at most 10 turns;
- history: at most 16,000 characters total;
- model output: at most 4,000 configured output tokens and 12,000 accepted characters.

Distributed request budgets are backed by the existing PostgreSQL `CaseActivityEvent` table, so no new table/migration is introduced for rate limiting:

- default `IB_AI_RATE_LIMIT_PER_MINUTE=6`;
- default `IB_AI_RATE_LIMIT_PER_DAY=100`;
- limits apply per authenticated client + case;
- reservation uses a transaction-scoped PostgreSQL advisory lock before count + insert, serializing concurrent reservations for that client/case across app instances;
- an allowed reservation writes `ai.request.accepted` before any model request;
- outcomes are restricted to `ai.response.completed`, `ai.response.restricted`, or `ai.response.failed`;
- audit metadata contains only the existing safe `schemaVersion` marker — no prompt, answer, email, name or other PII is written to activity metadata.

If the audit/rate-limit ledger cannot be written, the model request fails closed.

## Activation gates still required

Before declaring the AI feature production-ready:

1. configure a dedicated server-side OpenAI project/API key in staging;
2. select and pin the production model intentionally;
3. validate provider billing/limits and data controls;
4. run authenticated staging HTTP authorization/rate-limit tests against a non-production fixture case;
5. run a controlled staging provider smoke test without real client data;
6. verify the PostgreSQL advisory-lock rate-limit behavior under concurrent staging requests;
7. complete privacy/legal copy review;
8. perform final prompt-injection and abuse testing, including forged browser history roles;
9. remove the remaining demo identity/profile dependency from the shared `PlatformShell`;
10. complete the wider database baseline/migration and staging-runtime release gates.

No production deployment, production database mutation or real client AI request is part of this baseline.

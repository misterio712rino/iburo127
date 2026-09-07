# AI assistant production-readiness baseline

Status: code-level foundation. This document does not claim that a real OpenAI request has been executed in staging or production.

## Trust boundary

The browser is not trusted for identity, role, case ownership, plan, feature entitlement, case context, conversation-role authority, or prior assistant output.

`GET /api/platform/cases/:caseId/ai` returns the server-authorized, minimized AI view state without calling the model provider.

`POST /api/platform/cases/:caseId/ai`:

1. resolves the Better Auth server session;
2. maps it to the internal actor;
3. permits only `CLIENT` actors;
4. resolves the requested `ClientCase` through the existing server-side `ClientCaseService` access policy;
5. verifies that the authenticated client owns the case;
6. loads `PlanFeature` entitlements from PostgreSQL and requires `AI_ASSISTANT`;
7. reserves a PostgreSQL-backed request budget and writes a durable non-PII `ai.request.accepted` audit event;
8. rejects a current message containing recognized high-sensitive identifiers before provider egress;
9. intercepts recognized prompt-injection and restricted legal-action commands before provider egress;
10. builds a minimized case summary from PostgreSQL;
11. converts browser-supplied conversation history into an explicitly untrusted user-data block, omitting recognized prompt-injection and high-sensitive fragments instead of forwarding browser-controlled `assistant` roles;
12. calls the model provider only after the preceding checks pass and attaches a SHA-256 privacy-preserving `safety_identifier` derived from the authenticated internal user id;
13. accepts only a provider response whose Responses API status is exactly `completed`;
14. applies post-model legal/instruction-leak guards before returning content;
15. attempts a non-PII completion/restricted/failure outcome event without making an already-produced answer retriable if that secondary audit write fails.

A manager/lawyer role, an inaccessible case, a case without the feature, a request over budget, a recognized sensitive-data message, a recognized prompt-injection command, or a directly restricted legal-action request cannot reach the model provider through this client endpoint.

## Client state

The AI screen no longer uses `DemoIdentity`, demo case data or `demoAssistant` to decide access or generate responses.

Conversation state is intentionally memory-only in the browser tab. It is not written to `localStorage`. There is no server-side conversation-history persistence yet, so a page reload clears the chat.

The surrounding `PlatformShell` still has demo identity/profile dependencies and is tracked as a separate platform-wide migration blocker; server AI authorization does not trust that shell state.

The UI explicitly labels the feature as informational support and states that AI responses are not a final legal opinion. Important legal decisions remain subject to human review by the accompanying lawyer.

## Data minimization

The server-loaded external model context intentionally excludes:

- user id and AuthIdentity subject;
- name, email and phone;
- questionnaire answers;
- passport, SNILS, INN or banking fields;
- file names, object keys and file contents;
- document contents;
- task titles/descriptions;
- lawyer identity;
- internal case UUID and human-readable case number.

The context contains only plan/stage/case status, questionnaire/practicum progress counts, document taxonomy/status, aggregate task counts, ready-file count and the current user conversation accepted by the endpoint.

A current message containing recognized passport, SNILS, INN, payment-card/CVV, password or confirmation-code patterns is replaced with a deterministic warning and is not sent to OpenAI. Recognized sensitive identifiers inside browser-supplied history are replaced with `[OMITTED_SENSITIVE_DATA]` before the history block is built.

These recognizers are a defense-in-depth minimization layer, not a complete PII classifier. Users may still type other personal information that does not match the high-sensitive patterns. Final privacy notice and provider data-processing configuration therefore remain release gates.

## Untrusted conversation history and prompt injection

The browser may submit short conversation history for continuity, but its role labels are not trusted. After validation, the server serializes that history into a single `user`-role data block. A browser-provided `assistant` turn is labeled only as `previous_assistant_output` inside the serialized data and is never forwarded as a provider-level assistant-role message.

Recognized injection-like history content is replaced with `[OMITTED_UNTRUSTED_INSTRUCTION]`. The data block explicitly states that the transcript is untrusted, including any quoted prior assistant output, and cannot override internal instructions or legal/data-handling restrictions.

The current message is also checked for common instruction-override patterns such as attempts to ignore previous/system instructions, reveal system/developer instructions, disable protective rules, or enter a jailbreak/system/developer mode. Recognized attempts return a deterministic boundary response without a provider call.

This is defense in depth, not a claim that regex recognition can classify every possible prompt injection. Real-model adversarial testing remains mandatory before production enablement.

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
- a 64-character lowercase SHA-256 `safety_identifier` is required by the gateway for every request;
- the gateway accepts output only when provider status is exactly `completed`; `incomplete`, `failed`, `cancelled`, `queued`, `in_progress` and unknown statuses fail closed;
- upstream response/error bodies are never returned to the browser;
- raw network exceptions are normalized;
- every upstream request receives an `X-Client-Request-Id`.

The `safety_identifier` is derived from the internal authenticated user id rather than sending a name/email or raw internal id to the provider. The staging connectivity verifier uses a separate synthetic hash and contains no user/case data.

`store: false` prevents the application from opting into stored Responses objects, but it must not be described as a complete provider data-retention guarantee. Provider/project data-control and privacy configuration remain explicit release gates.

No OpenAI SDK dependency is required, so this foundation does not modify the dependency lockfile.

## Staging provider smoke verifier

`npm run check:staging:ai-provider` performs one intentionally small real provider request using only a hardcoded synthetic connectivity prompt. It never loads PostgreSQL, a client case, questionnaire data, documents or files.

The verifier fails closed unless all of these conditions hold before the network call:

- `IB_AI_TARGET` is exactly `staging`;
- `IB_AI_OPENAI_MODEL` exactly matches `IB_STAGING_OPENAI_MODEL`;
- SHA-256 of the supplied `OPENAI_API_KEY` exactly matches `IB_STAGING_OPENAI_KEY_SHA256`;
- `IB_STAGING_AI_CONFIRM` exactly equals `AI-SMOKE:<model>:<sha256>`.

The connectivity request uses a synthetic SHA-256 safety identifier. The model must reply with the exact marker `IB_AI_STAGING_OK`. Neither the API key, its fingerprint nor the model response is printed. The command is deliberately **not** part of `check:staging:release`, because it is an active external provider call with billing impact and must remain an explicit operator action.

This verifier has been added at code level only. A real OpenAI staging smoke request has not been executed by this work.

## Legal and output guardrails

The assistant is informational. It cannot:

- make the final legal decision for the client;
- issue a final legal opinion;
- guarantee the outcome of the bankruptcy procedure or a court decision;
- sign documents;
- send/file documents with a court;
- conclude contracts;
- represent the client in court.

Direct requests for those actions are intercepted before the external model call. Model output is checked for:

- claims that the assistant already signed/sent/filed/concluded something on the user's behalf;
- explicit final legal opinions/decisions;
- explicit guaranteed/100% outcome claims in protected legal-result contexts;
- recognized internal-instruction or raw internal-context leakage markers.

Recognized violations are replaced with deterministic safe responses and recorded as `ai.response.restricted`.

These deterministic checks supplement the model instructions. They are not a substitute for human legal review of high-stakes decisions.

## Request, cost and audit controls

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
- an allowed reservation writes durable `ai.request.accepted` **before** any model request;
- secondary outcomes are `ai.response.completed`, `ai.response.restricted`, or `ai.response.failed`;
- audit metadata contains only the existing safe `schemaVersion` marker — no prompt, answer, email, name or other PII is written to activity metadata.

The pre-provider reservation is fail-closed: if PostgreSQL/audit cannot accept it, the provider is not called. Secondary outcome writes happen after reservation and may occur after the provider has already generated or billed a response. Therefore an outcome-write failure is treated as an operational audit anomaly and does not replace a successful response with a retriable `503`, nor does it mask the original provider failure. An `ai.request.accepted` event with no matching later outcome is the durable signal that operators must investigate.

## Code-level adversarial coverage

The foundation suite covers, without a real provider call:

- forged browser `assistant` history treated only as untrusted data;
- injection-like history omitted before provider payload construction;
- common current-message instruction-override/jailbreak attempts blocked before provider call;
- sensitive passport/SNILS/INN/card/CVV/password patterns blocked from current-message provider egress;
- sensitive history content omitted;
- raw user id absent from the safety identifier and provider context;
- deterministic safety identifier stability and per-user separation;
- internal instruction/context leakage replacement;
- prohibited completion claims and explicit final/guaranteed legal conclusions replacement;
- `store: false`, empty tools and bounded output token contract;
- non-completed Responses API statuses rejected even if they contain partial output text;
- malformed/raw safety identifiers rejected before network fetch.

Passing these tests establishes the code contract only; it does not prove model behavior under every adversarial phrasing.

## Activation gates still required

Before declaring the AI feature production-ready:

1. configure a dedicated server-side OpenAI project/API key in staging;
2. select and pin the production model intentionally;
3. validate provider billing/limits and project data/privacy controls;
4. run authenticated staging HTTP authorization/rate-limit tests against a non-production fixture case;
5. execute the guarded staging provider smoke verifier and retain its PASS evidence;
6. verify the PostgreSQL advisory-lock rate-limit behavior under concurrent staging requests;
7. add monitoring for accepted AI requests that have no later outcome event;
8. complete privacy/legal copy review;
9. perform real-model staging red-team testing over representative and adversarial prompts, including forged browser history, obfuscated injection attempts, sensitive-data attempts and high-stakes legal-decision prompts;
10. confirm the human-review/escalation workflow with the accompanying lawyer for high-stakes decisions;
11. remove the remaining demo identity/profile dependency from the shared `PlatformShell`;
12. complete the wider database baseline/migration and staging-runtime release gates.

No production deployment, production database mutation or real client AI request is part of this baseline.

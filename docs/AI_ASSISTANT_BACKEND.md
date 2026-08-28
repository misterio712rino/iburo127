# AI assistant backend baseline

Status: code foundation only. This document does not claim that a real OpenAI request has been executed in staging or production.

## Trust boundary

The browser is not trusted for identity, role, case ownership, plan, feature entitlement, or case context.

`POST /api/platform/cases/:caseId/ai`

1. resolves the Better Auth server session;
2. maps it to the internal actor;
3. permits only `CLIENT` actors;
4. resolves the requested `ClientCase` through the existing server-side `ClientCaseService` access policy;
5. verifies that the authenticated client owns the case;
6. loads `PlanFeature` entitlements from PostgreSQL and requires `AI_ASSISTANT`;
7. builds a minimized case summary from PostgreSQL;
8. calls the model provider only after all authorization checks pass.

A manager/lawyer role, an inaccessible case, or a case without the feature cannot reach the model provider through this client endpoint.

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

Users can still type personal data in their own message. The system prompt explicitly tells the assistant not to solicit unnecessary sensitive data. A later release gate should cover the final privacy notice and provider data-processing configuration.

## Provider boundary

The current provider transport uses the OpenAI Responses API over server-side `fetch` only:

- exact endpoint: `https://api.openai.com/v1/responses`;
- API key is read server-side from `OPENAI_API_KEY`;
- model id is explicit in `IB_AI_OPENAI_MODEL`;
- `store: false` is always sent;
- tools are an empty array;
- request timeout is bounded;
- output tokens are bounded;
- upstream response/error bodies are never returned to the browser;
- raw network exceptions are normalized;
- every upstream request receives an `X-Client-Request-Id`.

No OpenAI SDK dependency is required, so this change does not modify the dependency lockfile.

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

## Request limits

Initial application-layer limits:

- message: 4,000 characters;
- history: at most 10 turns;
- history: at most 16,000 characters total;
- model output: at most 4,000 configured output tokens and 12,000 accepted characters.

A distributed per-user/case rate limiter is still required before unrestricted public activation. The current caps bound a single request, not request frequency.

## Activation gates still required

Before declaring the AI feature production-ready:

1. configure a dedicated server-side OpenAI project/API key;
2. select and pin the production model intentionally;
3. validate provider billing/limits and data controls;
4. add a distributed request/cost rate limit;
5. add non-PII AI request/outcome audit events;
6. run authenticated staging HTTP authorization tests;
7. run a controlled staging provider smoke test without real client data;
8. replace the demo client UI with the production API client;
9. complete privacy/legal copy review;
10. perform final prompt-injection and abuse testing.

No production deployment, production database mutation or real client AI request is part of this baseline.

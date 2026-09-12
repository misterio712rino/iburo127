# Production AI portal UI

Status: code-level production integration. This document does not claim that a real staging OpenAI request has been executed.

## Route

The authenticated client UI is available at:

`/portal/cases/:caseId/ai`

The page is a server component boundary before the client chat is rendered:

1. resolves the Better Auth production session;
2. maps the session to the internal actor;
3. requires the `CLIENT` role;
4. re-authorizes the concrete `ClientCase` through `ClientCaseService`;
5. verifies that the case belongs to the authenticated client;
6. passes only the authorized internal case id to the client AI component.

An inaccessible case or staff actor receives the normal not-found boundary and cannot use this client AI page.

## Demo separation

`/app` remains the isolated demonstration/showcase surface and may continue to use `DemoIdentityProvider` while other demo screens are migrated incrementally.

The production AI portal route does not use demo identity, demo case data or demo plan selection. `AiAssistant` now supports an explicit `caseId` and a `withShell={false}` mode so the production portal can embed the same production-backed chat without mounting the demo `PlatformShell`.

When a concrete case id is supplied, the client does not enumerate cases to select one. It asks the existing server-authorized AI state endpoint directly for that case.

## Entitlement and legal boundaries

The portal link is shown only to a server-authenticated `CLIENT` actor. This is UX filtering only; the backend remains authoritative and independently requires the `AI_ASSISTANT` feature before any provider request.

A client whose plan does not contain the feature receives the locked state. Browser role, plan and feature values are never trusted.

Existing legal restrictions remain unchanged: the assistant is informational and cannot make final legal decisions, issue final legal opinions, sign or file court documents, conclude contracts, or represent the user in court.

## Remaining acceptance work

Before declaring the portal AI feature production-ready:

- run the guarded staging provider smoke check with a dedicated staging OpenAI key;
- run authenticated staging HTTP tests against a non-production client fixture;
- verify rate-limit concurrency in staging PostgreSQL;
- review provider privacy/data-processing settings and user-facing privacy copy;
- perform prompt-injection/abuse QA in the real portal UI;
- visually QA the portal AI route on desktop and mobile;
- continue migrating the remaining non-AI demo `/app` surfaces independently.

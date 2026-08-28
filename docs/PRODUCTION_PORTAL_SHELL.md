# Shared production portal shell

Status: code-level migration foundation for the protected `/portal` surface.

## Separation from demo

`/app` remains the isolated demonstration/showcase surface and can continue using `DemoIdentityProvider` while demo screens are migrated independently.

`/portal` is the production-authenticated surface. Its shared frame does not import demo identity, demo profiles, demo plan data or client-controlled role information.

## PortalFrame

`components/portal/PortalFrame.tsx` centralizes the production portal chrome:

- iБюро brand linked to `/portal`;
- protected-session/access indicator;
- sign-out action;
- portal home navigation;
- notifications navigation;
- staff tasks navigation only when a server-resolved LAWYER/MANAGER actor enables it.

The frame receives only presentation booleans/labels from server components. It is not an authorization boundary: every protected page and API route continues to enforce its own Better Auth, role and ClientCase policy.

## First migrated pages

The first pass migrates:

- `/portal`;
- `/portal/cases/:caseId`;
- `/portal/cases/:caseId/ai`.

The case page derives staff navigation visibility from the authenticated internal actor. The AI page remains CLIENT-only and re-authorizes ownership of the concrete ClientCase before rendering the production-backed chat.

## Remaining portal migration

Nested production pages still carrying their older local headers should be migrated in later atomic passes:

- questionnaire;
- practicum;
- documents;
- files;
- activity;
- notifications;
- staff tasks.

This visual/layout migration must not weaken the existing per-page or API authorization checks.

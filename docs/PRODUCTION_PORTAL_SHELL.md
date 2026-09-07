# Shared production portal shell

Status: code-level production portal shell migration complete for the current `/portal` route set.

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

## Migrated pages

The shared frame is now used by the current production portal routes:

- `/portal`;
- `/portal/notifications`;
- `/portal/tasks`;
- `/portal/cases/:caseId`;
- `/portal/cases/:caseId/questionnaire`;
- `/portal/cases/:caseId/practicum`;
- `/portal/cases/:caseId/documents`;
- `/portal/cases/:caseId/files`;
- `/portal/cases/:caseId/activity`;
- `/portal/cases/:caseId/ai`.

Page-specific authorization remains unchanged. Client edit rights, lawyer assignment checks, manager review rights, task staff-only access, AI CLIENT-only ownership and AI feature entitlement are still enforced by the existing server operations/services and API routes.

## Remaining acceptance work

This shell migration is a code/layout change. Before release it still requires authenticated staging browser QA for desktop and mobile navigation, session expiry/sign-out behavior and each role's visible navigation.

The demo `/app` route is intentionally not coupled to this production shell.

# iБюро — Authentication & Authorization Architecture

## Objective

Replace presentation identity stored in the browser with a verified server-side actor while keeping the existing CLIENT / LAWYER / MANAGER UI contracts stable.

## Security rule

`DemoIdentityProvider`, route guards and browser state are UX/demo mechanisms only. They must never authorize access to real client data.

For production, every read or mutation of protected data must be scoped by a server-resolved actor.

## Actor model

The server should resolve an authenticated actor with at least:

- `userId`
- active role set
- account status
- permitted `ClientCase` scope

The browser may receive presentation-safe identity data after authorization, but it must not choose its own authoritative role or case scope.

## Role access

### CLIENT

May access only `ClientCase` records where `clientId === actor.userId`.

### LAWYER

May access only cases assigned to that lawyer unless a future explicit permission grants broader practice access.

### MANAGER

May access practice-level operational data only through an explicit manager role/permission boundary. Manager access must not be inferred from UI routes.

## Server flow

1. Resolve session on the server.
2. Resolve `User` and active roles.
3. Reject suspended/archived accounts.
4. Authorize requested role capability.
5. Scope the query to permitted `ClientCase` records.
6. Execute repository/service operation.
7. Return only data needed by the current screen.

## Repository rule

Repositories must not expose unscoped helpers to route code for protected records.

Preferred shape:

- `getClientCaseForClient(actorUserId, caseNumber)`
- `getAssignedCaseForLawyer(actorUserId, caseNumber)`
- `getCaseForManager(actorUserId, caseNumber)`

Avoid production helpers such as `getCaseByNumber(caseNumber)` unless they are private to a trusted service that performs authorization first.

## Mutation rule

Every mutation must repeat authorization on the server. A prior page load or client-side guard is not sufficient proof of access.

Examples:

- questionnaire save
- task status change
- document review
- file upload
- notification acknowledgement
- AI request using case context

## Migration from demo state

The current shared `lib/platform/access-policy.ts` is intentionally pure and UI-facing. It centralizes presentation role routing now and can later share role naming with server authorization, but it is not itself a security boundary.

Migration order:

1. introduce real session provider;
2. implement server actor resolver;
3. implement case-scoped authorization helpers;
4. move protected reads server-side;
5. move mutations server-side;
6. remove authoritative use of `DemoIdentityProvider`;
7. retain demo identity only in an explicitly isolated demo environment if still required.

## Non-goals for the current audit branch

- no authentication vendor is selected yet;
- no fake login is added;
- no real client data is enabled;
- no broad Prisma migration is performed;
- no weakening of the presentation RC is allowed.

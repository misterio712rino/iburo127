# iБюро — Production Readiness Audit

Branch: `audit/production-readiness`
Base: `demo/investor-preview` @ `c843ba7`

## Status

The audited branch now contains a production-oriented server foundation alongside the existing investor demo UX. The demo remains intentionally presentation-only; real client data must not use `DemoIdentityProvider` or browser identity state.

Repository-level hardening completed on this branch includes:
- CI with Prisma validation/generation, TypeScript, ESLint and production build;
- platform loading/error boundaries;
- role-specific presentation route guards for demo UX;
- server-side actor contracts and Prisma actor repository;
- query-level `ClientCase` access scoping plus defense-in-depth domain policy;
- provider-independent server session boundary;
- explicit external identity -> internal `User.id` mapping architecture;
- Prisma `AuthIdentity` model with unique `(provider, subject)` mapping;
- questionnaire persistence model, repository, case-scoped service, authenticated operations, transport/input/HTTP/route-adapter boundaries;
- workflow service facades between UI hooks and browser demo adapters for questionnaire, practicum and documents;
- shared task-state adapter for staff demo workflows.

No production database migration or production deployment has been executed from this audit branch.

## P0 — blockers before real client data

### 1. Real authentication provider/session issuance is not enabled yet

Completed foundation:
- `SessionProvider` contract;
- `ExternalSessionReader` + `AuthIdentityResolver` boundary;
- `MappedSessionProvider`;
- Prisma-backed `AuthIdentity` mapping;
- active-user resolution and database role lookup.

Still required before real users can sign in:
- choose and configure the concrete authentication/session provider;
- implement its trusted server-side `ExternalSessionReader`;
- implement account enrollment/recovery/MFA policy appropriate to the product;
- provision `AuthIdentity` records during controlled account linking.

Security rule: provider email/role/browser `userId` must never become an authorization source. Authorization continues to derive from internal `User`, `UserRole`, `Role` and case ownership/assignment.

### 2. Server authorization foundation is complete; production routes are not enabled

Completed:
- authenticated actor resolution;
- CLIENT / LAWYER / MANAGER case access policy;
- database-level access scoping in `PrismaClientCaseRepository`;
- defense-in-depth domain filtering;
- questionnaire case-scoped write policy;
- safe transport error mapping and untrusted input parsing.

Still required:
- wire a concrete production `SessionProvider` into actual Next.js route handlers/server actions;
- keep demo route guards only as presentation UX, never as production authorization.

### 3. Operational persistence is partially implemented

Questionnaire persistence foundation is implemented in Prisma and server code.

Still presentation-only:
- practicum progress;
- tasks/task history;
- document lifecycle/review state;
- activity/audit events;
- notifications;
- file metadata/storage.

These workflows now have service/adaptor boundaries where already refactored, so browser demo storage can be replaced incrementally without rewriting UI components.

## P1 — high priority engineering work

### 4. Database migration baseline is not established

The repository now contains additional Prisma models (`CaseQuestionnaire`, `AuthIdentity`), but migration history has not been applied to an authoritative PostgreSQL environment.

Before any migration:
1. confirm the real target PostgreSQL cluster and `DATABASE_URL`;
2. inspect the existing database schema/state;
3. establish a migration baseline if the database predates Prisma migration history;
4. generate and review SQL diff;
5. take a backup/snapshot;
6. apply only reviewed migrations.

Do not run broad `migrate dev`, `db push`, `npm audit fix`, or force operations against production.

### 5. CI baseline — COMPLETE

Current workflow validates:
- install from lockfile;
- Prisma schema;
- Prisma client generation;
- TypeScript;
- ESLint;
- production build.

This must remain a required quality gate for production work.

### 6. Error/loading boundary baseline — COMPLETE

Platform loading and error boundaries are present. Workflow-specific empty/retry states should be added when each workflow switches from demo storage to real server data.

## P2 — quality / maintainability

### 7. Demo source coupling — PARTIALLY RESOLVED

Completed service/facade boundaries:
- questionnaire;
- practicum;
- documents;
- shared task state.

Remaining demo datasets may still drive presentation content. That is acceptable while the investor demo coexists with production architecture, provided production server paths never trust demo identity/state.

### 8. Demo fallbacks — RESOLVED FOR KNOWN CLIENT FALLBACK

The previously identified Alexander fallback was removed. Continue to reject invalid authenticated state explicitly rather than silently selecting a demo identity.

## Existing strengths

- Next.js App Router structure is clear.
- `ClientCase` remains the central legal-case entity.
- Plan belongs to `ClientCase`, avoiding user-level tariff coupling.
- Prisma client creation is server-only and fails explicitly when `DATABASE_URL` is absent.
- Platform metadata is `noindex, nofollow` for the presentation environment.
- Role-specific client/staff experiences are visually separated.
- Production-oriented authorization now scopes data at repository/domain level rather than relying on browser guards.

## Remaining migration roadmap

### Phase A — repository hardening

Status: substantially complete.

### Phase B — authenticated shell

Repository foundation: complete.
External/provider work remaining:
- concrete login/session provider;
- account enrollment/recovery/MFA;
- production route wiring.

### Phase C — persistent workflows

Questionnaire foundation: substantially complete, pending DB baseline/migration and real auth wiring.

Next order:
1. practicum persistence;
2. tasks and task history;
3. document state/review lifecycle;
4. activity/audit trail;
5. notifications;
6. file metadata/storage.

### Phase D — integrations

After authenticated persistence is operational:
- AI backend scoped to a specific `ClientCase`;
- Bitrix integration as an external integration, not source of truth;
- operational notifications and document pipeline.

## Safety constraints

- do not modify `main`;
- do not merge or deploy production from this audit branch without final review;
- do not apply Prisma migrations until authoritative database baseline is confirmed;
- no fake authentication or browser identity bridge into production server paths;
- no broad dependency/security autofix without reviewing the resulting diff;
- never trust client-supplied user identity, role or case ownership.

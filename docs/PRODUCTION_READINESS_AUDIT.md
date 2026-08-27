# iБюро — Production Readiness Audit

Branch: `audit/production-readiness`
Base: `demo/investor-preview` @ `c843ba7`

## Status

Current application is a strong presentation/release-candidate build, but it is not yet a production MVP because identity, authorization and operational state are still client-side demo state.

## P0 — blockers before real client data

### 1. Authentication is not production-grade

Current identity is selected from browser state via `DemoIdentityProvider` and `localStorage` key `iburo.demo.identity.v1`.

Impact:
- any browser user can switch presentation identities;
- there is no verified server session;
- user identity cannot be trusted for real client data.

Required direction:
- introduce server-backed authentication;
- resolve authenticated user on the server;
- map account -> roles -> accessible ClientCase records;
- remove demo identity as authorization source.

### 2. Authorization is client-side only

`ClientRouteGuard` redirects in `useEffect` after hydration. This is presentation navigation protection, not an authorization boundary.

Impact:
- unsuitable for sensitive legal/client data;
- future APIs must never rely on this guard.

Required direction:
- add server-side authorization helpers;
- every server action/API/repository query must scope data by authenticated actor and case access;
- retain UI guards only as UX convenience.

### 3. Operational data is not persisted in PostgreSQL

Questionnaire, practicum, document review state and task lifecycle are presentation state rather than database-backed domain state.

Required direction:
- keep current UI contracts where practical;
- introduce server repositories/services behind them;
- migrate one domain at a time to reduce regression risk.

## P1 — high priority engineering work

### 4. Prisma domain is only a foundation

Existing models cover users, roles, plans, features, stages and cases. Missing persistence models are expected for production workflows, including at minimum:
- questionnaire answers / sections;
- practicum progress;
- generated documents and review status;
- tasks and task history;
- activity/audit events;
- notifications;
- stored file metadata.

Do not add these in one large migration. Design per bounded workflow.

### 5. No CI workflow is present

There is currently no `.github` workflow directory on the audited branch.

Required baseline:
- install from lockfile;
- Prisma generate;
- TypeScript check;
- ESLint;
- production build.

This should become mandatory before merging future production work.

### 6. Error/loading boundaries need production treatment

Current platform routes are optimized for static demo behavior. Before server data is introduced, add consistent loading/error/empty-state handling at role and workflow boundaries.

## P2 — quality / maintainability

### 7. Demo sources are strongly coupled to UI

`lib/platform/demo/*` is currently the source of truth for cases, dashboard data, documents, manager state, practicum, questionnaire and tasks.

Recommended migration pattern:
1. define domain-facing service interfaces;
2. keep demo adapters temporarily;
3. add PostgreSQL adapters;
4. switch route-by-route;
5. delete demo adapter only after parity validation.

### 8. Demo fallbacks can hide invalid state

Client dashboard falls back to the Alexander demo identity/case when identity data is not usable. This is acceptable for a presentation build, but must not survive into authenticated production data paths.

## Existing strengths

- Next.js App Router structure is clear.
- `ClientCase` is correctly modeled as the central legal-case entity.
- Plan belongs to `ClientCase`, avoiding user-level tariff coupling.
- Prisma client creation is server-only and fails explicitly when `DATABASE_URL` is absent.
- Platform metadata is already `noindex, nofollow` for the presentation environment.
- Current Vercel production deployment shows no runtime errors in the checked period.
- Role-specific client/staff experiences are visually separated and already tested as an RC.

## Migration roadmap

### Phase A — hardening without changing the demo UX

- add CI;
- add route-level error/loading boundaries where useful;
- introduce server auth/authorization architecture without enabling real client data yet;
- define repository/service interfaces for `ClientCase` access.

### Phase B — authenticated shell

- real login/session;
- server-side actor resolution;
- CLIENT / LAWYER / MANAGER authorization;
- case-scoped data access.

### Phase C — persistent workflows

Suggested order:
1. questionnaire;
2. practicum progress;
3. tasks;
4. document state/review;
5. activity/audit trail;
6. notifications;
7. file storage.

### Phase D — integrations

- AI backend scoped to a specific ClientCase;
- Bitrix integration as external integration, not source of truth;
- operational notifications and document pipeline.

## Safety constraints

- do not modify `main`;
- keep production RC stable while audit work happens on a separate branch;
- no broad Prisma migration without a reviewed schema plan;
- no fake success actions;
- no new dependencies without justification;
- no client-side authorization assumptions for real data.

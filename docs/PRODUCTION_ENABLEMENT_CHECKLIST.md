# iБюро — Production Enablement Checklist

This checklist defines the conditions for switching any platform workflow from investor-demo state to real client data.

## Global gates

- [ ] Authoritative PostgreSQL cluster confirmed and reachable from the deployment environment.
- [ ] Current database schema inspected and backed up.
- [ ] Prisma migration baseline established without destructive drift.
- [x] Authentication product direction selected: Better Auth, self-hosted against PostgreSQL.
- [x] Better Auth dependency/configuration installed on the audit branch with controlled lockfile changes.
- [x] Provider-specific Better Auth session-reader boundary implemented.
- [x] Next.js `headers()` -> Better Auth `auth.api.getSession` bridge contract implemented.
- [x] Real Better Auth server instance wired into that bridge.
- [x] External `(provider, subject)` -> internal `User.id` mapping architecture implemented through `AuthIdentity`.
- [ ] Account enrollment, recovery and MFA policy implemented end-to-end; staff MFA mandatory.
- [x] Production infrastructure environment readers/template implemented without committing secrets.
- [x] Production server architecture does not use `DemoIdentityProvider`, localStorage identity, browser role or browser user ID as authorization sources.
- [x] Repository CI gate includes Prisma validate/generate, foundation tests, TypeScript, ESLint and production build.
- [ ] CI is green on the exact future production release commit after staging infrastructure wiring.
- [ ] Security review confirms case-scoped authorization for every enabled real-data endpoint against a real staging database.
- [x] Transport foundations return normalized public error codes instead of raw internal exception text.
- [x] Private workflow JSON responses use `private, no-store` cache policy.
- [ ] Production logs verified not to contain questionnaire answers, document contents or other sensitive payloads.

## Questionnaire gates

Repository/server foundation is complete; activation still requires:

- [x] `CaseQuestionnaire` schema and ownership model reviewed.
- [x] Case-scoped repository/service/transport/route-adapter foundation implemented.
- [x] Optimistic concurrency/version conflict modeled.
- [x] Real Better Auth-backed `SessionProvider` wired into Next.js questionnaire API route handlers.
- [ ] `CaseQuestionnaire` migration SQL generated and reviewed against the authoritative DB baseline.
- [ ] Migration applied to a non-production environment first.
- [ ] Client UI route uses authenticated `ClientCase.id`, not demo identity IDs.
- [ ] Optimistic concurrency conflict (`409`) handled in UI.
- [ ] Empty/loading/retry states verified with real server data.
- [ ] DB-backed cross-role E2E verifies CLIENT owner write, LAWYER assigned read, MANAGER read and unauthorized denial.
- [ ] Questionnaire schema-version upgrade strategy exercised before changing questionnaire fields in production.

## Practicum gates

- [x] Persistence model implemented.
- [x] Case-scoped progress repository/service implemented.
- [x] Authenticated operations and transport/route-adapter foundation implemented.
- [x] Authenticated Next.js practicum API routes implemented.
- [ ] Migration SQL reviewed and applied to staging.
- [ ] Demo workflow service swapped to authenticated server transport after parity validation.
- [ ] Real-data loading/error/conflict states verified.

## Tasks gates

- [x] Task assignment semantics implemented for LAWYER/MANAGER access.
- [x] Task status history/audit model implemented.
- [x] Server task repository/service/transport foundation implemented.
- [x] Foundation tests cover lawyer/manager/client authorization behavior.
- [x] Authenticated task list/get/status API routes implemented.
- [ ] Migration SQL reviewed and applied to staging.
- [ ] Browser task state replaced as authoritative state in real-data routes.
- [ ] DB-backed cross-role assignment tests completed.

## Documents gates

- [x] Document lifecycle/status model implemented.
- [x] Case-scoped document repository/service/transport foundation implemented.
- [x] Review actions modeled as server-authorized lifecycle changes.
- [x] Authenticated document list/get/create/regenerate/review routes implemented.
- [x] Private stored-file metadata model/repository/service foundation implemented.
- [x] Private object storage product direction selected: Yandex Object Storage.
- [x] Provider-neutral short-lived signed URL contract implemented.
- [x] Yandex-specific private storage policy adapter implemented: bucket scoping, safe object keys, 30–900 second TTL policy.
- [x] AWS SDK S3 signer/client dependencies added with controlled lockfile changes.
- [x] Authorized private file list/metadata/download-URL API routes implemented.
- [x] Signed private upload preparation + HEAD-verified completion flow implemented.
- [x] Pending uploads remain hidden from normal file list/get/download operations until verification succeeds.
- [x] Upload input enforces allowlisted MIME types, a 50 MiB limit and UUID-scoped opaque keys.
- [x] Browser-supplied checksum values are not persisted as trusted integrity metadata; checksum support remains reserved for a future server-verified flow.
- [ ] Private staging bucket/service account configured.
- [ ] Add stale `PENDING_UPLOAD` cleanup after staging storage policy is available.
- [ ] Document/file migrations reviewed and applied to staging.
- [ ] No generated document or uploaded file exposed by a guessable public URL in staging E2E.
- [ ] DB-backed upload/download/review/audit E2E completed.

## Activity / audit gates

- [x] Activity event persistence foundation implemented.
- [x] Case-scoped access service/transport foundation implemented.
- [x] Authenticated case activity API route implemented.
- [x] Controlled event taxonomy implemented.
- [x] Activity metadata allowlist rejects unapproved fields and long values to reduce sensitive-data leakage risk.
- [ ] Approve the final audit retention period before production data is enabled.
- [ ] Wire critical questionnaire/task/document/file/auth events into the audit trail.
- [ ] Verify production logs and stored audit metadata contain no sensitive payloads during DB-backed E2E.

## Notifications gates

- [x] Notification persistence/service/transport foundation implemented.
- [x] Controlled in-app notification taxonomy implemented.
- [x] Authenticated notification list/mark-read API routes implemented.
- [ ] Define external notification delivery channels and provider(s).
- [ ] Add idempotency/delivery-attempt semantics before external dispatch.
- [ ] Verify recipient scoping and no cross-user notification exposure with DB-backed tests.

## Authentication implementation gates

Architecture decision: see `docs/AUTH_PROVIDER_DECISION.md`.

- [x] Provider-independent `SessionProvider` boundary implemented.
- [x] `AuthIdentity` mapping model implemented.
- [x] Active internal user + internal role resolution implemented.
- [x] Better Auth selected as preferred self-hosted provider.
- [x] Better Auth external identity/session-reader boundary implemented without trusting provider IDs as internal IDs.
- [x] Provider-neutral Next.js server-session bridge implemented against `auth.api.getSession({ headers })`.
- [x] Better Auth dependency added with controlled lockfile update.
- [x] Better Auth server instance configured for PostgreSQL without running production migrations.
- [x] `/api/auth/[...all]` route handler added.
- [x] Actual Better Auth server instance wired into the session bridge.
- [x] TOTP/2FA plugin configured at the server layer.
- [x] Standalone `/auth/sign-in` UI implemented outside `DemoIdentityProvider`; self-sign-up remains disabled.
- [x] TOTP verification and one-time backup-code verification UI implemented with `trustDevice: false`.
- [ ] Add sign-out control in the authenticated production shell.
- [ ] Add password reset/email verification delivery and UI after an outbound email provider is selected.
- [ ] Add TOTP enrollment/backup-code issuance UX and enforce MFA for staff accounts.
- [ ] Implement controlled `AuthIdentity` linking/provisioning against staging data.
- [ ] Replace platform demo identity selection with authenticated shell in the production-enabled deployment only.

## Staging runbook

- [x] Staging activation sequence documented in `docs/STAGING_ACTIVATION_RUNBOOK.md`.
- [x] Read-only staging preflight script implemented as `npm run check:staging`.

## Release safety

- Never run `prisma db push` against production as a substitute for reviewed migrations.
- Never run Better Auth auto-migrations directly against production; generate/review SQL first.
- Never run `npm audit fix --force` automatically on the release branch.
- Never merge `audit/production-readiness` into `main` until the exact diff and CI are reviewed.
- Never point production traffic at an audit deployment until authentication and the database baseline are confirmed.
- Keep the investor demo isolated from production authorization even if both experiences coexist in one codebase.

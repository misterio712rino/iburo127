# iБюро — Production Enablement Checklist

This checklist defines the conditions for switching any platform workflow from investor-demo state to real client data.

## Global gates

- [ ] Authoritative PostgreSQL cluster confirmed and reachable from the deployment environment.
- [ ] Current database schema inspected and backed up.
- [ ] Prisma migration baseline established without destructive drift.
- [x] Read-only PostgreSQL baseline inspection command implemented as `npm run db:inspect:baseline`; it does not run migrations, DDL, DML or read user table contents.
- [x] Migration SQL review gate implemented as `npm run db:review:sql`; destructive/high-risk SQL is fingerprinted and automatically blocked or flagged before staging application.
- [x] Guarded staging-only migration deploy command implemented as `npm run db:deploy:staging`; it requires an exact database-name match and explicit confirmation before `prisma migrate deploy` can run.
- [x] Read-only post-migration staging schema verification implemented as `npm run db:verify:staging`; it verifies required domain tables/enums and rejects unfinished Prisma migrations without reading client data.
- [x] Authentication product direction selected: Better Auth, self-hosted against PostgreSQL.
- [x] Better Auth dependency/configuration installed on the audit branch with controlled lockfile changes.
- [x] Provider-specific Better Auth session-reader boundary implemented.
- [x] Next.js `headers()` -> Better Auth `auth.api.getSession` bridge contract implemented.
- [x] Real Better Auth server instance wired into that bridge.
- [x] External `(provider, subject)` -> internal `User.id` mapping architecture implemented through `AuthIdentity`.
- [x] Guarded server-side `AuthIdentity` provisioning primitive and CLI implemented without exposing a public provisioning endpoint.
- [ ] Account enrollment, recovery and MFA policy implemented end-to-end; staff MFA mandatory.
- [x] Production infrastructure environment readers/template implemented without committing secrets.
- [x] Production server architecture does not use `DemoIdentityProvider`, localStorage identity, browser role or browser user ID as authorization sources.
- [x] Repository CI gate includes Prisma validate/generate, foundation tests, TypeScript, ESLint and production build.
- [ ] CI is green on the exact future production release commit after staging infrastructure wiring.
- [ ] Security review confirms case-scoped authorization for every enabled real-data endpoint against a real staging database.
- [x] Transport foundations return normalized public error codes instead of raw internal exception text.
- [x] Private workflow JSON responses use `private, no-store` cache policy.
- [x] Questionnaire, practicum and document create-on-first-use repositories recover safely from concurrent unique-key creation races.
- [ ] Production logs verified not to contain questionnaire answers, document contents or other sensitive payloads.

## Questionnaire gates

Repository/server foundation is complete; activation still requires:

- [x] `CaseQuestionnaire` schema and ownership model reviewed.
- [x] Case-scoped repository/service/transport/route-adapter foundation implemented.
- [x] Optimistic concurrency/version conflict modeled.
- [x] Real Better Auth-backed `SessionProvider` wired into Next.js questionnaire API route handlers.
- [ ] `CaseQuestionnaire` migration SQL generated and reviewed against the authoritative DB baseline.
- [ ] Migration applied to a non-production environment first.
- [x] Production portal route resolves authenticated `ClientCase.id`, not demo identity IDs.
- [x] Editable production questionnaire UI uses authenticated APIs and handles optimistic-concurrency `409` by refreshing authoritative state.
- [x] Domain validation enforces field types/options, conditional required fields, section completeness and immutable completed state.
- [ ] Empty/loading/retry states verified with real server data.
- [ ] DB-backed cross-role E2E verifies CLIENT owner write, LAWYER assigned read, MANAGER read and unauthorized denial.
- [ ] Questionnaire schema-version upgrade strategy exercised before changing questionnaire fields in production.

## Practicum gates

- [x] Persistence model implemented.
- [x] Case-scoped progress repository/service implemented.
- [x] Authenticated operations and transport/route-adapter foundation implemented.
- [x] Authenticated Next.js practicum API routes implemented.
- [x] Production portal uses authenticated server transport for start/progress/lesson completion with required concurrency tokens.
- [x] Canonical practicum content is separated from demo seed state.
- [ ] Migration SQL reviewed and applied to staging.
- [ ] Real-data loading/error/conflict states verified.

## Tasks gates

- [x] Task assignment semantics implemented for LAWYER/MANAGER access.
- [x] Task status history/audit model implemented.
- [x] Server task repository/service/transport foundation implemented.
- [x] Foundation tests cover lawyer/manager/client authorization behavior.
- [x] Authenticated task list/get/status API routes implemented.
- [x] Authenticated staff portal reads authoritative server tasks and updates lifecycle with required concurrency tokens.
- [ ] Migration SQL reviewed and applied to staging.
- [ ] DB-backed cross-role assignment tests completed.

## Documents gates

- [x] Document lifecycle/status model implemented.
- [x] Case-scoped document repository/service/transport foundation implemented.
- [x] Review actions modeled as server-authorized lifecycle changes.
- [x] Authenticated document list/get/create/regenerate/review routes implemented.
- [x] Production portal exposes client create/regenerate/send-for-review and staff review actions through authenticated APIs.
- [x] Canonical document definitions are separated from demo seed/preview state.
- [x] Private stored-file metadata model/repository/service foundation implemented.
- [x] Private object storage product direction selected: Yandex Object Storage.
- [x] Provider-neutral short-lived signed URL contract implemented.
- [x] Yandex-specific private storage policy adapter implemented: bucket scoping, safe object keys, 30–900 second TTL policy.
- [x] AWS SDK S3 signer/client dependencies added with controlled lockfile changes.
- [x] Authorized private file list/metadata/download-URL API routes implemented.
- [x] Signed private upload preparation + HEAD-verified completion flow implemented.
- [x] Production portal supports direct signed upload, server verification and signed download without exposing object keys.
- [x] Pending uploads remain hidden from normal file list/get/download operations until verification succeeds.
- [x] Upload input enforces allowlisted MIME types, a 50 MiB limit and UUID-scoped opaque keys.
- [x] Browser-supplied checksum values are not persisted as trusted integrity metadata; checksum support remains reserved for a future server-verified flow.
- [x] Stale `PENDING_UPLOAD` cleanup service/repository foundation implemented with bounded batches and conditional metadata deletion.
- [ ] Private staging bucket/service account configured.
- [ ] Schedule/operate stale `PENDING_UPLOAD` cleanup only after staging storage policy is available.
- [ ] Document/file migrations reviewed and applied to staging.
- [ ] No generated document or uploaded file exposed by a guessable public URL in staging E2E.
- [ ] DB-backed upload/download/review/audit E2E completed.

## Activity / audit gates

- [x] Activity event persistence foundation implemented.
- [x] Case-scoped access service/transport foundation implemented.
- [x] Authenticated case activity API route implemented.
- [x] Controlled event taxonomy implemented.
- [x] Activity metadata allowlist rejects unapproved fields and long values to reduce sensitive-data leakage risk.
- [x] Authenticated case activity is exposed in the production portal without raw sensitive payloads.
- [ ] Approve the final audit retention period before production data is enabled.
- [ ] Wire critical questionnaire/task/document/file/auth events into the audit trail with transaction/failure semantics that cannot report a failed workflow after its business mutation already committed.
- [ ] Verify production logs and stored audit metadata contain no sensitive payloads during DB-backed E2E.

## Notifications gates

- [x] Notification persistence/service/transport foundation implemented.
- [x] Controlled in-app notification taxonomy implemented.
- [x] Authenticated notification list/mark-read API routes implemented.
- [x] Production portal lists only the current user's notifications and supports mark-read through authenticated transport.
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
- [x] Sign-out control implemented in the authenticated production portal shell.
- [x] Controlled `AuthIdentity` provisioning command documented in `docs/AUTH_IDENTITY_PROVISIONING.md`; it requires an active internal user and explicit confirmation.
- [ ] Add password reset/email verification delivery and UI after an outbound email provider is selected.
- [ ] Add TOTP enrollment/backup-code issuance UX and enforce MFA for staff accounts.
- [ ] Execute and verify controlled `AuthIdentity` linking against migrated staging data.
- [ ] Replace platform demo identity selection with authenticated shell in the production-enabled deployment only.

## Staging runbook

- [x] Staging activation sequence documented in `docs/STAGING_ACTIVATION_RUNBOOK.md`.
- [x] Read-only staging preflight script implemented as `npm run check:staging`.
- [x] Read-only authoritative database structure inspection documented in `docs/DATABASE_BASELINE_INSPECTION.md` and implemented as `npm run db:inspect:baseline`.
- [x] Migration SQL review gate documented in `docs/MIGRATION_SQL_REVIEW_GATE.md` and implemented as `npm run db:review:sql`.
- [x] Guarded staging migration deployment documented in `docs/STAGING_MIGRATION_DEPLOY.md` and implemented as `npm run db:deploy:staging`; no production deploy command exists.
- [x] Read-only post-migration schema verification documented in `docs/STAGING_POST_MIGRATION_VERIFICATION.md` and implemented as `npm run db:verify:staging`.
- [x] Read-only staging authorization fixture verification documented in `docs/STAGING_AUTHZ_VERIFICATION.md` and implemented as `npm run check:staging:authz`.

## Release safety

- Never run `prisma db push` against production as a substitute for reviewed migrations.
- Never run Better Auth auto-migrations directly against production; generate/review SQL first.
- Never run `npm audit fix --force` automatically on the release branch.
- Never merge `audit/production-readiness` into `main` until the exact diff and CI are reviewed.
- Never point production traffic at an audit deployment until authentication and the database baseline are confirmed.
- Keep the investor demo isolated from production authorization even if both experiences coexist in one codebase.

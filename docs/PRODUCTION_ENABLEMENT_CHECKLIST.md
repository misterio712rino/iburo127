# iБюро — Production Enablement Checklist

This checklist defines the conditions for switching any platform workflow from investor-demo state to real client data.

## Global gates

- [ ] Authoritative PostgreSQL cluster confirmed and reachable from the deployment environment.
- [ ] Current database schema inspected and backed up.
- [ ] Prisma migration baseline established without destructive drift.
- [x] Public-safe read-only PostgreSQL baseline summary implemented as `npm run db:inspect:baseline:summary`; exact staging target guards run before connection and output is limited to aggregate counts plus conservative A/B/C/D/REVIEW classification.
- [x] Full read-only PostgreSQL structural baseline inspection implemented as `npm run db:inspect:baseline`; it reads no user-table payloads and refuses to run under GitHub Actions so internal schema structure is not dumped into this public repository's CI logs.
- [x] Migration SQL review gate implemented as `npm run db:review:sql`; destructive/high-risk SQL is fingerprinted and automatically blocked or flagged before staging application.
- [x] Guarded staging-only migration deploy command implemented as `npm run db:deploy:staging`; it requires an exact database-name match and explicit confirmation before `prisma migrate deploy` can run.
- [x] Read-only post-migration staging schema verification implemented as `npm run db:verify:staging`; it verifies required domain tables/enums, the complete StoredFile malware-scan lifecycle columns/status values, and rejects unfinished Prisma migrations without reading client data.
- [x] Authentication product direction selected: Better Auth, self-hosted against PostgreSQL.
- [x] Better Auth dependency/configuration installed on the audit branch with controlled lockfile changes.
- [x] Provider-specific Better Auth session-reader boundary implemented.
- [x] Next.js `headers()` -> Better Auth `auth.api.getSession` bridge contract implemented.
- [x] Real Better Auth server instance wired into that bridge.
- [x] External `(provider, subject)` -> internal `User.id` mapping architecture implemented through `AuthIdentity`.
- [x] Guarded server-side `AuthIdentity` provisioning primitive and CLI implemented without exposing a public provisioning endpoint.
- [x] Staff TOTP enrollment, backup-code issuance and mandatory staff MFA policy implemented at the server authorization boundary.
- [x] Password-reset/email-verification delivery foundation and recovery UI implemented with dedicated Yandex Cloud Postbox credentials.
- [ ] Account enrollment/recovery verified end-to-end against migrated staging identities and actual Postbox delivery.
- [x] Production infrastructure environment readers/template implemented without committing secrets.
- [x] Production server architecture does not use `DemoIdentityProvider`, localStorage identity, browser role or browser user ID as authorization sources.
- [x] Repository CI gate includes Prisma validate/generate, foundation tests, TypeScript, ESLint and production build.
- [ ] CI is green on the exact future production release commit after staging infrastructure wiring.
- [ ] Security review confirms case-scoped authorization for every enabled real-data endpoint against a real staging database.
- [x] Transport foundations return normalized public error codes instead of raw internal exception text.
- [x] Private workflow JSON responses use `private, no-store` cache policy.
- [x] Cookie-authenticated `/api/platform/*` mutations are protected by a centralized Next.js `proxy.ts` origin policy: browser mutations require the exact configured application `Origin`, contradictory Fetch Metadata is rejected, and the repository Node staging verifier has only a narrow non-browser compatibility path.
- [x] Platform JSON mutation bodies are byte-bounded by a shared 64 KiB reader; actual streamed bytes are counted independently of `Content-Length`, oversized bodies return `413 PAYLOAD_TOO_LARGE`, and CI rejects new raw body reads in platform routes/adapters.
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

## Documents / private files gates

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
- [x] Upload input enforces allowlisted MIME types, a 50 MiB limit and UUID-scoped opaque keys.
- [x] Browser-supplied checksum values are not persisted as trusted integrity metadata; checksum support remains reserved for a future server-verified flow.
- [x] Stale `PENDING_UPLOAD` cleanup service/repository foundation implemented with bounded batches and conditional metadata deletion.
- [x] Upload completion no longer trusts metadata verification as a malware verdict: verified uploads atomically transition `PENDING_UPLOAD -> PENDING_SCAN`, not `READY`, with `file.upload.completed` audit creation.
- [x] Download/list/get paths remain fail-closed: only `StoredFile.status === READY` is visible/authorized; `PENDING_SCAN`, `SCANNING`, `QUARANTINED` and `SCAN_FAILED` cannot receive a user-facing signed download URL.
- [x] Provider-neutral malware scan worker foundation implemented with DB-backed UUID leases, expired-lease reclaim, bounded retries/backoff, terminal failure and matching-lease finalization.
- [x] `CLEAN` is the only scanner verdict that can transition `SCANNING -> READY`; `MALICIOUS` transitions to `QUARANTINED`; scanner/storage errors never fail open to READY.
- [x] Controlled HTTPS scanner client foundation implemented with an independent bearer secret, signed-Yandex-source allowlist, redirect refusal, timeout, bounded 16 KiB response, strict `CLEAN|MALICIOUS` verdict schema and normalized provider/network errors.
- [x] Scanner request privacy boundary sends only a short-lived signed source URL, MIME type and size; it does not send filename, clientCaseId, user ID or application authentication credentials.
- [x] Protected `POST /api/internal/maintenance/file-scans` and provider-neutral `npm run maintenance:run:file-scans` runner implemented; endpoint returns aggregate counters only and reports terminal failures/lease-loss anomalies as unhealthy.
- [x] Scan security defaults are CI-pinned: initial batch size 1, scanner timeout shorter than lease, source URL TTL at least the lease duration, and bounded retry configuration.
- [x] Read-only staging schema verifier requires all scan lifecycle enum values and StoredFile scan/lease/retry columns before staging schema PASS.
- [x] File malware/quarantine architecture and activation gates documented in `docs/FILE_UPLOAD_SECURITY.md`.
- [x] Read-only staging Object Storage metadata verifier implemented as `npm run check:staging:storage`; it checks bucket identity/ACL/policy/CORS without listing, reading, writing or deleting objects.
- [ ] Authoritative database baseline inspected before generating the StoredFile quarantine migration.
- [ ] StoredFile/UserSecurityEvent and other pending migration SQL generated from the authoritative baseline, manually reviewed, and applied to staging only.
- [ ] Private staging bucket/service account configured and verified with staging credentials.
- [ ] Controlled HTTPS malware scanner service provisioned in staging with an independent secret.
- [ ] Clean benign fixture verifies `CLEAN -> READY` in staging.
- [ ] Provider-approved benign antivirus detection fixture verifies `MALICIOUS -> QUARANTINED` in staging without using a real malicious artifact.
- [ ] Scanner outage/retry, expired-lease reclaim and maximum-attempt `SCAN_FAILED` behavior verified against staging.
- [ ] File-scan maintenance scheduler configured independently and its 503 failure path wired to alerting.
- [ ] Maximum 50 MiB file scanning latency measured and scanner/lease/scheduler timeouts reviewed.
- [ ] Quarantine retention/deletion policy and incident-response ownership approved.
- [ ] Schedule/operate stale `PENDING_UPLOAD` cleanup only after staging storage policy is available.
- [ ] No generated document or uploaded file exposed by a guessable public URL in staging E2E.
- [ ] DB-backed upload/scan/quarantine/download/review/audit E2E completed.

## Activity / audit gates

- [x] Activity event persistence foundation implemented.
- [x] Case-scoped access service/transport foundation implemented.
- [x] Authenticated case activity API route implemented.
- [x] Controlled event taxonomy implemented.
- [x] Activity metadata allowlist rejects unapproved fields and long values to reduce sensitive-data leakage risk.
- [x] Authenticated case activity is exposed in the production portal without raw sensitive payloads.
- [x] Critical questionnaire/task/document/file mutations that currently emit case activity write the business mutation and corresponding `CaseActivityEvent` in the same Prisma transaction.
- [x] File scan lifecycle emits controlled system audit events for clean/quarantined/failed outcomes without storing signed source URLs, scanner secrets or free-form scanner exception text.
- [x] Separate user-scoped auth security audit foundation implemented for successful sign-in, TOTP verification, backup-code use and password-reset request/completion; it stores only internal `User.id`, controlled event type and timestamp.
- [x] AI requests use a server-generated opaque UUIDv4 `auditId` to correlate `ai.request.accepted` with exactly the corresponding completion/restricted/failure outcome, and a bounded read-only maintenance health check detects accepted requests that remain without an outcome after the configured grace period.
- [ ] Apply/review the `UserSecurityEvent` migration in staging and verify Better Auth lifecycle events against mapped test identities.
- [ ] Approve the final audit retention period before production data is enabled.
- [ ] Verify production logs and stored audit metadata contain no sensitive payloads during DB-backed E2E.

## Notifications gates

- [x] Notification persistence/service/transport foundation implemented.
- [x] Controlled in-app notification taxonomy implemented.
- [x] Authenticated notification list/mark-read API routes implemented.
- [x] Production portal lists only the current user's notifications and supports mark-read through authenticated transport.
- [x] External email delivery provider selected and implemented through Yandex Cloud Postbox with dedicated server-side credentials.
- [x] Durable transactional notification-delivery outbox implements stable dedupe keys, delivery attempts, optimistic leases, retry/backoff and terminal `DEAD` state; delivery is explicitly documented as at-least-once rather than exactly-once.
- [ ] Verify recipient scoping and no cross-user notification exposure with DB-backed tests.
- [ ] Configure and observe the external notification scheduler against staging, including retry/dead-state alerting.

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
- [x] TOTP enrollment/backup-code issuance UX implemented and MFA enforced server-side for LAWYER/MANAGER accounts.
- [x] Sign-out control implemented in the authenticated production portal shell.
- [x] Controlled `AuthIdentity` provisioning command documented in `docs/AUTH_IDENTITY_PROVISIONING.md`; it requires an active internal user and explicit confirmation.
- [x] Yandex Cloud Postbox selected and password reset/email-verification delivery callbacks plus forgot/reset-password UI implemented.
- [x] Better Auth lifecycle hooks/callbacks wired to the non-blocking user-scoped `UserSecurityEvent` audit foundation without storing auth secrets or browser PII.
- [x] Production-enabled routes use the authenticated `/portal` shell; the separate `/app` investor demo remains isolated and fail-closed unless `IB_DEMO_PORTAL_MODE=enabled` exactly.
- [ ] Verify actual Postbox receipt, reset-token flow, session revocation and provider-side delivery health against staging.
- [ ] Decide whether to require email verification only after existing staging identities and mail delivery are reviewed.
- [ ] Execute and verify controlled `AuthIdentity` linking against migrated staging data.

## Maintenance / operational gates

- [x] Provider-neutral authenticated runner supports notification delivery, stale upload cleanup, file malware scans and AI audit health as four independent fixed jobs.
- [x] Maintenance endpoints are POST-only, bearer protected, no-store, bounded, reject runner redirects, and return unhealthy status for operational conditions requiring attention.
- [x] File-scan maintenance response exposes aggregate counters only, not file/case/user IDs, lease tokens or scanner source URLs.
- [ ] Actual production/staging scheduler platform confirmed.
- [ ] Four jobs provisioned independently against staging.
- [ ] Scheduler failure exits/HTTP 503 wired to operational alerting.
- [ ] File scanner service health/availability monitoring and `SCAN_FAILED` incident handling verified.

## Staging runbook

- [x] Staging activation sequence documented in `docs/STAGING_ACTIVATION_RUNBOOK.md`.
- [x] Read-only staging preflight script implemented as `npm run check:staging`.
- [x] Public-safe staging database baseline summary documented in `docs/DATABASE_BASELINE_INSPECTION.md` and implemented as `npm run db:inspect:baseline:summary`; it is the first database classification gate.
- [x] Full read-only authoritative database structure inspection documented in `docs/DATABASE_BASELINE_INSPECTION.md` and implemented as `npm run db:inspect:baseline`; run only in a trusted environment, never as a public GitHub Actions structural dump.
- [x] Migration SQL review gate documented in `docs/MIGRATION_SQL_REVIEW_GATE.md` and implemented as `npm run db:review:sql`.
- [x] Guarded staging migration deployment documented in `docs/STAGING_MIGRATION_DEPLOY.md` and implemented as `npm run db:deploy:staging`; no production deploy command exists.
- [x] Read-only post-migration schema verification documented in `docs/STAGING_POST_MIGRATION_VERIFICATION.md` and implemented as `npm run db:verify:staging`; it now includes StoredFile malware-scan lifecycle columns and status values.
- [x] Read-only Better Auth schema verification documented in `docs/STAGING_BETTER_AUTH_SCHEMA_VERIFICATION.md` and implemented as `npm run check:staging:auth-schema`.
- [x] Read-only staging Object Storage verification documented in `docs/STAGING_OBJECT_STORAGE_VERIFICATION.md` and implemented as `npm run check:staging:storage`.
- [x] Read-only staging authorization fixture verification documented in `docs/STAGING_AUTHZ_VERIFICATION.md` and implemented as `npm run check:staging:authz`.

## Release safety

- Never run `prisma db push` against production as a substitute for reviewed migrations.
- Never run Better Auth auto-migrations directly against production; generate/review SQL first.
- Never run `npm audit fix --force` automatically on the release branch.
- Never bypass `PENDING_SCAN`, `QUARANTINED` or `SCAN_FAILED` by manually setting uploaded files to `READY`.
- Never merge `audit/production-readiness` into `main` until the exact diff and CI are reviewed.
- Never point production traffic at an audit deployment until authentication and the database baseline are confirmed.
- Keep the investor demo isolated from production authorization even if both experiences coexist in one codebase.

# iБюро — Staging Activation Runbook

Purpose: activate the production-oriented backend safely in a non-production environment before any real-client traffic.

## Hard stop conditions

Do not proceed to the next phase if any of these are unknown:

- authoritative PostgreSQL cluster and database name;
- verified backup/snapshot point;
- staging deployment hostname;
- Better Auth secret and cookie/base URL configuration;
- private Yandex Object Storage bucket and service-account credentials.

Never substitute production credentials while validating staging.

## Phase 1 — Database baseline

1. Confirm the authoritative PostgreSQL target.
2. Record engine/version, database name, schema owner and connectivity path.
3. Create a snapshot/backup before any DDL.
4. Inspect the current schema and migration history.
5. If the database predates Prisma migration history, establish a Prisma baseline instead of replaying historical DDL.
6. Generate SQL diff from the baseline to the current `prisma/schema.prisma`.
7. Review the SQL for destructive operations, implicit casts, table rewrites and unexpected drops.
8. Apply the reviewed migration to staging only.
9. Run `prisma validate`, `prisma generate`, application smoke tests and DB-backed workflow tests.

## Phase 2 — Better Auth wiring

1. Add Better Auth with a controlled package-lock change.
2. Configure a server-only auth instance against the staging PostgreSQL database.
3. Generate Better Auth schema SQL; do not auto-migrate production.
4. Review and apply Better Auth schema changes to staging.
5. Enable email/password and verification/recovery flows.
6. Enable TOTP 2FA and backup codes; staff accounts must enroll before staff routes are considered production-ready.
7. Add the Better Auth Next.js route handler.
8. Bind `auth.api.getSession({ headers })` through `createBetterAuthNextSessionLoader` and `BetterAuthExternalSessionReader`.
9. Link the verified Better Auth subject to the internal `User.id` through `AuthIdentity`.
10. Verify that a valid Better Auth session for a suspended internal user still resolves to no platform access.

## Phase 3 — Private object storage

1. Create a private Yandex Object Storage bucket.
2. Create a dedicated service account with the minimum bucket permissions needed by the application.
3. Configure staging environment variables only; never commit credentials.
4. Bind the S3-compatible signer/client to `YandexPrivateObjectStorage`.
5. Keep generated object keys opaque: `cases/<caseUuid>/<fileUuid>/object.<ext>`.
6. Use short-lived signed URLs only; current application policy allows 30–900 seconds.
7. Verify upload MIME/type/size policy before issuing an upload URL and verify the uploaded object metadata before registering it as trusted.
8. Verify download authorization through `StoredFileService` before generating a signed download URL.
9. Confirm bucket/list/public ACL access is disabled.

## Phase 4 — Workflow activation order

Activate one workflow at a time to preserve parity and rollback clarity:

1. Questionnaire.
2. Practicum.
3. Tasks and task history.
4. Documents and review lifecycle.
5. File metadata/storage.
6. Activity/audit wiring.
7. Notifications.

For each workflow:

- use server-derived actor identity;
- use authoritative `ClientCase.id` from accessible server state;
- keep optimistic concurrency/version conflicts explicit;
- verify loading/empty/retry/conflict UI states;
- run cross-role authorization tests before enabling it for the next role.

## Phase 5 — Security E2E matrix

Minimum matrix:

- CLIENT owner can access own case data only;
- another CLIENT cannot access it;
- assigned LAWYER can access assigned case data only;
- another LAWYER cannot access it;
- MANAGER access matches the current single-practice policy;
- roleless/suspended users receive no case data;
- browser-supplied user ID, role, tariff or ownership claims have no effect;
- object download URLs cannot be obtained for inaccessible cases;
- raw questionnaire/document contents are absent from logs and error responses.

## Phase 6 — Release gate

A staging candidate is acceptable only when the exact commit has:

- green CI;
- green production build;
- reviewed migration SQL;
- successful staging migration;
- successful auth/session tests;
- successful DB-backed cross-role E2E;
- private storage checks;
- runtime error review;
- rollback point documented.

Only after these gates should a separate production release decision be made. This runbook does not authorize merging to `main`, migrating production, changing DNS or deploying production traffic.

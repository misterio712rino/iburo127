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

## Phase 0 — Read-only infrastructure preflight

Before generating or applying any migration, configure staging-only environment variables from `.env.example` and run:

```bash
npm run check:staging
```

The check is intentionally read-only. It validates required environment values, executes a PostgreSQL health query and performs `HeadBucket` against the configured Yandex Object Storage bucket. It does not print credentials, mutate database state, upload objects, run Prisma migrations or create auth tables.

Expected terminal marker:

```text
STAGING_READINESS_PASS
```

If it fails, stop and fix connectivity/credentials before any DDL or auth provisioning.

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

1. Confirm the already-installed Better Auth package and reviewed lockfile on the staging candidate.
2. Configure the server-only auth instance against the staging PostgreSQL database.
3. Generate Better Auth schema SQL; do not auto-migrate production.
4. Review and apply Better Auth schema changes to staging.
5. Enable email/password verification/recovery only after the delivery channel is configured.
6. Enroll TOTP 2FA and preserve backup codes; staff accounts must enroll before staff routes are considered production-ready.
7. Verify `/api/auth/[...all]` against the staging hostname.
8. Verify `auth.api.getSession({ headers })` through `createBetterAuthNextSessionLoader` and `BetterAuthExternalSessionReader`.
9. Link the verified Better Auth subject to internal `User.id` through `AuthIdentity`.
10. Verify that a valid Better Auth session for a suspended internal user still resolves to no platform access.

## Phase 3 — Private object storage

1. Create a private Yandex Object Storage bucket.
2. Create a dedicated service account with the minimum bucket permissions needed by the application.
3. Configure staging environment variables only; never commit credentials.
4. Verify the S3-compatible signer/client through `npm run check:staging`.
5. Keep generated object keys opaque: `cases/<caseUuid>/<fileUuid>/object.<ext>`.
6. Use short-lived signed URLs only; current application policy allows 30–900 seconds.
7. Upload preparation creates a `PENDING_UPLOAD` metadata row and a five-minute signed PUT URL.
8. Upload completion verifies the object with `HEAD`; exact size and content type must match before the row becomes `READY`.
9. `PENDING_UPLOAD` rows are excluded from normal list/get/download operations.
10. Verify download authorization through `StoredFileService` before generating a signed download URL.
11. Confirm bucket/list/public ACL access is disabled.
12. Define cleanup for stale `PENDING_UPLOAD` metadata and orphan objects before production traffic.

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
- pending uploads cannot be listed or downloaded before verification;
- upload completion rejects missing or size/type-mismatched objects;
- raw questionnaire/document contents are absent from logs and error responses.

## Phase 6 — Release gate

A staging candidate is acceptable only when the exact commit has:

- green CI;
- green production build;
- `STAGING_READINESS_PASS` against staging-only infrastructure;
- reviewed migration SQL;
- successful staging migration;
- successful auth/session tests;
- successful DB-backed cross-role E2E;
- private storage checks;
- runtime error review;
- rollback point documented.

Only after these gates should a separate production release decision be made. This runbook does not authorize merging to `main`, migrating production, changing DNS or deploying production traffic.

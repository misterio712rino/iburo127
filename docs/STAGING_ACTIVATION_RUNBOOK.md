# iБюро — Staging Activation Runbook

Purpose: activate the production-oriented backend safely in a non-production environment before any real-client traffic.

## Hard stop conditions

Do not proceed if any of these are unknown:

- authoritative staging PostgreSQL host, database name and database user;
- verified backup/snapshot point;
- staging deployment hostname;
- Better Auth secret and base URL configuration;
- private Yandex Object Storage staging bucket and service-account credentials;
- dedicated Yandex Cloud Postbox staging sender and service-account/static-key credentials.

Never substitute production credentials while validating staging.

## Staging target identity guard

Every staging DB command must be configured with all of the following:

```text
IB_DB_TARGET=staging
IB_STAGING_DATABASE_HOST=<exact host from DATABASE_URL>
IB_STAGING_DATABASE_NAME=<exact database from DATABASE_URL>
IB_STAGING_DATABASE_USER=<exact user from DATABASE_URL>
```

The repository performs a network-free preflight against `DATABASE_URL` before staging DB verification, staging AuthIdentity provisioning, and `prisma migrate deploy`. A host/database/user mismatch fails closed before PostgreSQL is contacted.

Run the guard directly with:

```bash
npm run check:staging:target
```

## Phase 0 — Read-only infrastructure preflight

Configure staging-only environment variables from `.env.example` and run:

```bash
npm run check:staging
```

This gate is read-only. It:

1. validates the exact staging DB URL identity before connecting;
2. opens a PostgreSQL `READ ONLY` transaction and verifies the connected database identity;
3. validates Better Auth runtime configuration structurally;
4. runs the staging Object Storage security verifier, which reads bucket metadata only and checks ACL, bucket policy and CORS.

It does not run migrations, provision identities, enumerate/download/upload/delete objects, mutate bucket configuration, or send email.

Expected terminal marker:

```text
STAGING_READINESS_PASS
```

If it fails, stop and fix staging identity/connectivity/security configuration before any DDL or provisioning.

## Phase 1 — Database baseline and reviewed migration

1. Confirm the authoritative staging PostgreSQL target.
2. Create/verify a snapshot or backup before any DDL.
3. Inspect the current schema and migration history.
4. If the database predates Prisma migration history, establish a reviewed baseline instead of replaying historical DDL blindly.
5. Generate and review migration SQL for destructive operations, implicit casts, table rewrites and unexpected drops.
6. Set the explicit confirmation token:

```text
IB_STAGING_MIGRATION_CONFIRM=MIGRATE:<IB_STAGING_DATABASE_NAME>
```

7. Apply reviewed migrations to staging only:

```bash
npm run db:deploy:staging
```

The command re-runs the network-free target guard, verifies the connected database identity, and only then invokes `prisma migrate deploy`.

## Phase 2 — Better Auth wiring

1. Verify the Better Auth schema on staging with `npm run check:staging:auth-schema`.
2. Do not use Better Auth auto-migration against production.
3. Configure password recovery/email delivery before declaring recovery production-ready.
4. Enroll TOTP 2FA for LAWYER and MANAGER accounts before staff routes are considered production-ready.
5. Link verified Better Auth subjects to internal users only through the staging-only guarded command:

```bash
npm run auth:link:staging
```

6. Verify that suspended/roleless internal users resolve to no platform access.

## Phase 3 — Private Object Storage

Run:

```bash
npm run check:staging:storage
```

The verifier is read-only and checks:

- exact staging bucket identity guard;
- no public `AllUsers` / `AuthenticatedUsers` ACL grants;
- bucket policy: absent/deny-only can pass automatically, any `Allow` semantics require manual policy review;
- exact-origin CORS required by the signed browser `PUT` flow;
- no object enumeration/content operation is performed.

A green repository CI proves only that the verifier compiles. The remote staging bucket is not verified until the command is actually executed with staging credentials.

## Phase 4 — Postbox delivery simulator

Postbox verification is an active provider-side send and therefore remains separate from the read-only aggregate gates.

Use only a dedicated staging sender/service account/static key. Configure the exact sender and key-id guards, then set:

```text
IB_EMAIL_TARGET=staging
IB_STAGING_POSTBOX_CONFIRM=SIMULATOR:<IB_STAGING_POSTBOX_FROM_EMAIL>
```

Run:

```bash
npm run check:staging:email-delivery
```

The recipient is hardcoded to `success@simulator.pstbx.ru`; it cannot be replaced through environment variables. A successful run sends no message to a real user. Clear `IB_STAGING_POSTBOX_CONFIRM` after the check.

See `docs/STAGING_POSTBOX_VERIFICATION.md` for the exact target-identity guard and timeout/error-handling contract.

## Phase 5 — Workflow activation

Activate one workflow at a time:

1. Questionnaire.
2. Practicum.
3. Tasks/history.
4. Documents/review lifecycle.
5. File metadata/storage.
6. Activity/audit.
7. Notifications.

For each workflow, use server-derived actor identity, authoritative `ClientCase.id`, explicit optimistic concurrency, and cross-role authorization checks.

## Phase 6 — Security E2E matrix

Minimum matrix:

- CLIENT owner can access own case only;
- another CLIENT cannot;
- assigned LAWYER can access assigned case only;
- another LAWYER cannot;
- MANAGER follows the current practice-wide policy;
- roleless/suspended users receive no case data;
- browser-supplied user id, role, tariff or ownership claims have no effect;
- inaccessible cases cannot obtain signed file downloads;
- pending uploads cannot be listed/downloaded before verification;
- upload completion rejects missing or size/type-mismatched objects;
- questionnaire/document contents are absent from runtime logs/error responses.

## Phase 7 — Full staging release gate

After schema, Better Auth tables and controlled staging fixtures exist, run:

```bash
npm run check:staging:release
```

This aggregate read-only gate runs:

- staging core readiness;
- domain schema verification;
- Better Auth schema verification;
- Object Storage security verification;
- staging AuthIdentity/role/case fixture verification.

It intentionally does not send a Postbox simulator message; run `check:staging:email-delivery` separately when validating the staging mail transport.

Expected terminal marker:

```text
STAGING_RELEASE_READINESS_PASS
```

A staging candidate is acceptable only when the exact commit also has green GitHub Actions CI, reviewed migration SQL, successful staging migration, real DB-backed cross-role E2E, runtime error review, a successful dedicated staging Postbox simulator check, and a documented rollback point.

This runbook does not authorize merging to `main`, migrating production, changing DNS, changing the production bucket, using production Postbox credentials, or deploying production traffic.

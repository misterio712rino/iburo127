# Staging database baseline and migration runbook


## Additional read-only staging inspection — 2026-10-13

The connected Neon project `iburo127-staging-neon`, its ready default branch `main`, and database `neondb` were checked through read-only Neon tools. The database catalog summary was:

- one user schema (`public`);
- 32 base tables, 271 columns, 14 enum types containing 50 labels, 97 indexes, and 265 constraints; no views.
- four successfully applied migrations and zero unfinished migrations;
- one historical rolled-back migration attempt for `20260831_initial_baseline`, followed by its successful application;
- no commerce tables yet, consistent with the unapplied commerce foundation migration.
- At the time of the catalog inspection, the feature branch had ten migrations; staging had the first four applied. The branch now has eleven migrations after adding the retention-decision migration, so seven remain unapplied. The probe's `pendingCount: 3` refers only to the seven-entry history in the deployed `audit/production-readiness` revision.


The inspection queried PostgreSQL catalog metadata and migration history only; it did not query customer, case, document, or payment rows. A full catalog snapshot is preserved in [`staging-schema-snapshot-2026-10-13.json`](./staging-schema-snapshot-2026-10-13.json). It includes table/column definitions, enum labels, constraints, indexes, and views, with no row data.

Backup metadata was checked read-only: no snapshot schedule is configured for the staging branch. One manual snapshot is listed, created on 2026-09-07 (`pre-durable-deletion-94c737-20260907`). A fresh snapshot attempt on 2026-10-13 was rejected because the project snapshot limit was exceeded. Creating a temporary branch with custom compute settings was also rejected by an account restriction; no branch was created. No restore validation was run, so this is not evidence of a current, tested recovery point.

The full PostgreSQL catalog snapshot is preserved, but the repository inspector's own fingerprint has not been independently generated, and backup/restore readiness remains unverified. The migration-history SHA-256 was approved for the feature Preview branch and configured there; this does not authorize a migration. No migration or restore operation has been run.

## Schema reconciliation against the feature branch — 2026-10-13

The catalog snapshot was compared with `prisma/schema.prisma` from `feature/document-intake-retention-20261013`:

- All columns for the 25 Prisma models already present in staging match the feature schema; six additional tables are Better Auth tables, plus `_prisma_migrations`.
- Six Prisma models are absent from staging: `CaseDocumentRevision` (defined in the supplemental schema file), `ClientCaseFileRetentionDecision`, `CommerceOrder`, `CommercePayment`, `CommercePaymentEvent`, and `CommerceCheckoutSessionRecovery`. Their six enum types are also absent: document-revision status, retention choice, and the four commerce enums.
- The original ten committed migration directories did not create `ClientCaseFileRetentionDecision`. I added `20261013_client_case_file_retention_decision` to the feature branch with the table, enum, indexes, and foreign keys matching the current Prisma model. This is SQL preparation only; it has not been applied to any database.
- The pending `20260917_case_document_revisions` migration creates `CaseDocumentRevision` and `CaseDocumentRevisionStatus`. They are defined in `prisma/document-revisions.prisma`; `prisma.config.ts` uses the `prisma` directory as the schema, so this migration is represented in the multi-file Prisma schema. Both objects are absent from staging because the migration is pending.
- Four of eleven feature-branch migrations are applied. The seven pending directories include document revisions, commerce foundation/idempotency, three checkout/recovery migrations, and the new retention-decision migration.

These are structural differences only. No application records were read.

## Current repository status

The staging catalog has now been captured and compared with the feature branch. The branch contains the main Prisma schema, the supplemental document-revisions schema, and 11 migration directories. The catalog comparison confirms the five application models represented by pending migrations plus the new retention model are not yet present in staging. Do not create a replacement baseline or apply migrations until the actual staging structure has been inspected and reconciled with this history.

## Safety invariants

- PostgreSQL remains the source of truth.
- Production database mutation is not supported by repository scripts.
- `db:inspect:baseline` is staging-only even though it is read-only: the full staging host/database/user target guard must pass before a PostgreSQL connection is created.
- Never use `prisma db push` against production or staging as a replacement for reviewed migrations.
- Never use Better Auth auto-migration against production.
- Staging mutations require reviewed repository migration history, the exact staging target guard, a mutation-specific confirmation, and a read-only verification of the actual staging schema/migration state before any write-capable client is created or invoked.
- A staging migration additionally requires an exact SHA-256 fingerprint of the reviewed repository migration history.

## Required sequence

1. Configure the exact staging target identity and run `npm run db:inspect:baseline`. The inspector validates staging host/database/user before connection, opens an explicit read-only transaction, then verifies `current_database()` and `current_user`. Preserve the structural fingerprint and review the complete structural snapshot.
2. Determine whether the database is empty, already contains application tables, contains Better Auth tables, or contains legacy/unmanaged structures. Do not assume an empty database.
3. Reconcile the inspected structure with `prisma/schema.prisma` and the existing migration history. Decide whether the history represents the authoritative baseline before changing or adding migration files.
4. If the review identifies a required schema change, generate a new migration only from the approved baseline strategy. Do not replace the existing initial migration or apply the new SQL yet.
5. Review each generated `migration.sql` with `IB_MIGRATION_SQL_PATH=<path> npm run db:review:sql` and perform manual review for data-loss, locking, uniqueness, nullability, enum and index changes.
6. Review the complete migration history and `migration_lock.toml` (`provider = "postgresql"`) as one unit. The reviewed history must be committed before it is used for staging operations.
7. Run `npm run db:inspect:migrations`. Compare the result with the fingerprint approved by the staging owner; a locally calculated value is not approval.
8. Set `IB_STAGING_MIGRATION_HISTORY_SHA256` from the trusted, approved source. `npm run db:check:migrations` must pass. Never substitute a locally calculated fingerprint for the approved value.
9. Confirm a current staging backup exists and perform a restore validation before the first migration of a meaningful environment.
10. Run the read-only staging checks and schema preflight.
11. For the single staging migration operation, set `IB_STAGING_MIGRATION_CONFIRM=MIGRATE:<database-name>` and run `npm run db:deploy:staging`.
12. Run `npm run db:verify:staging` and the remaining staging release checks.

## Fail-closed behavior

`db:deploy:staging` refuses to connect to PostgreSQL when any of the following is true:

- `prisma/migrations/` is missing;
- `migration_lock.toml` is missing or is not PostgreSQL;
- no migration directory exists;
- a migration is missing `migration.sql` or has empty SQL;
- migration directories contain unexpected files;
- `IB_STAGING_MIGRATION_HISTORY_SHA256` is absent, malformed or does not exactly match the committed history.

After those repository-level checks pass, the existing staging database target guard and `MIGRATE:<database>` confirmation still apply before `prisma migrate deploy` is executed.

`db:verify:staging` is also fail-closed. It cannot report `STAGING_SCHEMA_VERIFY_PASS` merely because the expected domain tables and enums exist. It additionally requires:

- a real `_prisma_migrations` table in the staging database;
- at least one successfully applied Prisma migration;
- zero unfinished, non-rolled-back migrations;
- the full staging database target guard, including host, database name and user, before connection;
- post-connect verification of both `current_database()` and `current_user`.

This prevents an unmanaged or partially migrated schema from being treated as release-ready.

## Guarded staging mutations

The following mutation entrypoints share the same reviewed staging mutation preflight:

- `npm run db:seed:reference:staging`;
- `npm run db:seed:demo:staging`;
- `npm run auth:link:staging`.

Before mutation they require, in order:

1. a committed migration history whose exact SHA-256 matches `IB_STAGING_MIGRATION_HISTORY_SHA256`;
2. exact staging host/database/user validation;
3. the operation-specific confirmation;
4. a read-only staging schema verification proving the required tables/enums, `_prisma_migrations`, at least one applied migration, zero unfinished migrations, and matching connected database/user identity.

Reference seed confirmation remains `REFERENCE-SEED:<database-name>`. Demo seed confirmation remains `DEMO-SEED:<database-name>`. AuthIdentity provisioning is more narrowly bound and requires `LINK:<database-name>:<internal-user-id>`.

Because the current 11-migration fingerprint is not approved/configured and restore readiness remains unverified, all three mutation entrypoints remain blocked before staging database access.

## Current blocker

Staging migration status remains **BLOCKED_BASELINE** until the 11-migration history is reconciled and approved, its exact SHA-256 is configured, and a current backup passes restore validation. The previously approved ten-migration hash remains configured on the feature Preview branch but does not match the current history, so the migration guard fails closed.

## Preview environment access findings (2026-10-13)

- Vercel project metadata shows `IB_DB_TARGET` and `DATABASE_URL` are configured as sensitive variables for Preview branch `audit/production-readiness`. Their values were not retrieved.
- The local `vercel env run -e preview --git-branch audit/production-readiness` attempt did not pass these variables to the baseline inspector; its staging target guard stopped execution before opening a PostgreSQL connection. Vercel documents branch-specific `env run` syntax, while sensitive variable values are not readable after creation. See [Vercel CLI env](https://vercel.com/docs/cli/env) and [sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables). Do not change the variables from sensitive to readable merely to make local inspection work.
- The Vercel metadata comment for `DATABASE_URL` labels it as a Neon staging database, and `.github/workflows/staging-revision-migration-proof.yml` expects database name `neondb`. The actual connection host was not verified because the value is hidden. Reconcile this with any older infrastructure notes before connecting.
- `IB_STAGING_MIGRATION_HISTORY_SHA256` remains absent on `audit/production-readiness`. Feature Preview still has the previously approved ten-migration fingerprint; it is stale against the current eleven-entry history and does not pass the migration guard.
- The repository already has a read-only `/_iburo/staging-db-baseline` Preview probe referenced by `.github/workflows/staging-revision-migration-proof.yml`. Use that controlled path to inspect the database identity and migration state; this note does not authorize running it or any database mutation.


## Read-only probe result — 2026-10-13

The user authorized a read-only baseline probe. The protected Preview endpoint returned HTTP 200 and confirmed:

- service `iburo127`, environment `preview`, branch `audit/production-readiness`, runtime target `staging`;
- deployment commit `1d7cb0b5e9b6e2fee71ded11953cc93f00d85d0a`;
- database identity `neondb.public`;
- read-only mode and overall probe checks passed;
- required domain tables: 21/21; required enums: 12/12; stored-file scan/status contracts passed;
- Better Auth tables: 6/6;
- deployed migration history: 4 applied, 3 pending, 0 unfinished, 7 expected; applied history is an exact prefix of the deployed revision's reviewed history.

The probe reads PostgreSQL catalog metadata and migration history only; it does not return customer, document, or payment records. It does **not** return the full structural snapshot; a separate catalog-only query is now preserved in the JSON artifact above. The endpoint is deployed from `audit/production-readiness` and checks seven migration entries. At the time of the probe, the feature branch had ten entries; it now has eleven. The separate schema comparison found the retention model had no migration, which has since been added to the feature branch, and confirms the expected pending commerce and document-revision objects.

Migration deployment remains blocked until the current 11-migration history is owner-approved, a current backup passes restore validation, and the schema/migration history is reconciled. Do not treat the successful bounded probe or the feature-branch SQL preparation as migration approval.

A candidate migration-history fingerprint was independently calculated from all eleven committed migration SQL files and `migration_lock.toml` using the repository guard's algorithm:

```text
9184a493a0b591815e1e74d7bf33201074b4052166a9c61de7cbd1e4d733cb52
```

This eleven-migration fingerprint is a candidate only; it has not been approved or configured. The feature Preview environment still contains the previous ten-migration hash, which no longer matches, so `db:check:migrations` must fail closed. The repository checkout was unavailable for running `npm run db:inspect:migrations` or `npm run db:review:sql`; independent recomputation matched the previously approved ten-migration hash before the new migration was added. The SQL review heuristic finds no blocking destructive statement and flags `ON DELETE CASCADE` for manual review. Its use here matches the retention decision's lifecycle: deleting the case deletes its decision record.


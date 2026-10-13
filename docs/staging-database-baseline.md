# Staging database baseline and migration runbook

## Current repository status

The authoritative staging database baseline is not confirmed yet. This working copy contains `prisma/schema.prisma` and 10 Prisma migration directories, including the initial baseline and the Stripe checkout/recovery migrations. Their presence in the repository does not prove that staging was inspected against this history, that the history is the approved one, or that these migrations have been applied there. Do not create a replacement baseline or apply migrations until the actual staging structure has been inspected and reconciled with this history.

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

Because the staging baseline and the approved fingerprint for the current migration history have not yet been confirmed, all three mutation entrypoints remain blocked before staging database access.

## Current blocker

Until the authoritative staging database has been inspected, reconciled with the existing migration history, and the exact reviewed history fingerprint has been approved by the staging owner, staging migration status is **BLOCKED_BASELINE**. This is expected and must not be bypassed.

## Preview environment access findings (2026-10-13)

- Vercel project metadata shows `IB_DB_TARGET` and `DATABASE_URL` are configured as sensitive variables for Preview branch `audit/production-readiness`. Their values were not retrieved.
- The local `vercel env run -e preview --git-branch audit/production-readiness` attempt did not pass these variables to the baseline inspector; its staging target guard stopped execution before opening a PostgreSQL connection. Vercel documents branch-specific `env run` syntax, while sensitive variable values are not readable after creation. See [Vercel CLI env](https://vercel.com/docs/cli/env) and [sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables). Do not change the variables from sensitive to readable merely to make local inspection work.
- The Vercel metadata comment for `DATABASE_URL` labels it as a Neon staging database, and `.github/workflows/staging-revision-migration-proof.yml` expects database name `neondb`. The actual connection host was not verified because the value is hidden. Reconcile this with any older infrastructure notes before connecting.
- `IB_STAGING_MIGRATION_HISTORY_SHA256` is not configured for that Preview branch. Migration checks remain blocked until the staging owner approves the exact fingerprint for the reviewed committed history.
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

The probe reads PostgreSQL catalog metadata and migration history only; it does not return customer, document, or payment records. It does **not** return the full structural snapshot or its fingerprint, so the authoritative full structural baseline remains unconfirmed. The endpoint is deployed from `audit/production-readiness` and checks seven migration entries. The current feature branch contains ten entries, including three newer commerce migrations; this probe did not reconcile those three against staging.

Migration deployment remains blocked until the full staging structure is reconciled, the exact ten-migration history fingerprint is approved and configured, and backup/restore readiness is confirmed. Do not treat the successful bounded probe as migration approval.

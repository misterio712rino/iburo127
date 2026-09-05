# Staging database baseline and migration runbook

## Current repository status

The authoritative database baseline is not resolved yet. The repository currently has `prisma/schema.prisma` but no committed `prisma/migrations/` history. This is an intentional release blocker: do not manufacture or deploy an initial migration until the actual staging/authoritative database structure has been inspected and reconciled.

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
3. Reconcile the inspected structure with `prisma/schema.prisma` and decide the baseline strategy before creating migration files.
4. Generate migration SQL only from the reviewed baseline strategy. Do not apply it yet.
5. Review each generated `migration.sql` with `IB_MIGRATION_SQL_PATH=<path> npm run db:review:sql` and perform manual review for data-loss, locking, uniqueness, nullability, enum and index changes.
6. Commit the reviewed `prisma/migrations/` history, including `migration_lock.toml` with `provider = "postgresql"`.
7. Run `npm run db:inspect:migrations`. Record the reported migration-history SHA-256 only after the SQL review is complete.
8. Set `IB_STAGING_MIGRATION_HISTORY_SHA256` to that exact lowercase SHA-256 value. `npm run db:check:migrations` must pass.
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

Because the repository currently has no reviewed `prisma/migrations/` history, all three mutation entrypoints are intentionally blocked before staging database access.

## Current blocker

Until the authoritative staging database has been inspected and the migration/baseline strategy has been reviewed, staging migration status is **BLOCKED_BASELINE**. This is expected and must not be bypassed.

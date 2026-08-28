# Staging database baseline and migration runbook

## Current repository status

The authoritative database baseline is not resolved yet. The repository currently has `prisma/schema.prisma` but no committed `prisma/migrations/` history. This is an intentional release blocker: do not manufacture or deploy an initial migration until the actual staging/authoritative database structure has been inspected and reconciled.

## Safety invariants

- PostgreSQL remains the source of truth.
- Production database mutation is not supported by repository scripts.
- Never use `prisma db push` against production or staging as a replacement for reviewed migrations.
- Never use Better Auth auto-migration against production.
- Staging mutations require the existing exact database target guard and an operation-specific confirmation.
- A staging migration additionally requires an exact SHA-256 fingerprint of the reviewed repository migration history.

## Required sequence

1. Run `npm run db:inspect:baseline` against the intended database using read-only access where possible. Preserve the structural fingerprint and review the complete structural snapshot.
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

`db:deploy:staging` now refuses to connect to PostgreSQL when any of the following is true:

- `prisma/migrations/` is missing;
- `migration_lock.toml` is missing or is not PostgreSQL;
- no migration directory exists;
- a migration is missing `migration.sql` or has empty SQL;
- `IB_STAGING_MIGRATION_HISTORY_SHA256` is absent, malformed or does not exactly match the committed history.

After those repository-level checks pass, the existing staging database target guard and `MIGRATE:<database>` confirmation still apply before `prisma migrate deploy` is executed.

## Current blocker

Until the authoritative database has been inspected and the migration/baseline strategy has been reviewed, staging migration status is **BLOCKED_BASELINE**. This is expected and must not be bypassed.

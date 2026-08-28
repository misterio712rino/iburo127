# iБюро — Post-migration staging verification

This runbook defines the read-only verification that must run immediately after reviewed Prisma migrations are applied to staging.

## Command

```bash
npm run db:verify:staging
```

Required environment variables:

```text
DATABASE_URL=<staging PostgreSQL connection string>
IB_DB_TARGET=staging
IB_STAGING_DATABASE_NAME=<exact current_database() value>
```

The verifier opens a `BEGIN READ ONLY` transaction and rolls it back after inspection.

## What is verified

The command verifies:

1. The connected database name exactly matches `IB_STAGING_DATABASE_NAME`.
2. All required iБюро domain tables exist in the `public` schema.
3. All required PostgreSQL enums from the current Prisma domain schema exist.
4. If `_prisma_migrations` exists, there are no migration records with both `finished_at IS NULL` and `rolled_back_at IS NULL`.

It does not read questionnaire answers, document contents, file contents, credentials, emails, phones or other client payloads.

## Scope

This command verifies the iБюро domain schema only. Better Auth owns a separate authentication schema lifecycle and must be reviewed and verified separately before authentication is enabled for real staging users.

If `_prisma_migrations` is absent, the command emits a warning instead of silently treating migration history as established. That condition still requires explicit baseline review.

## Required order after migration

```text
npm run db:deploy:staging
npm run db:verify:staging
npm run check:staging
npm run check:staging:authz
```

Then run DB-backed authenticated E2E for CLIENT, LAWYER and MANAGER.

A successful schema verification is not production approval. It only confirms that the expected domain structures are present and no unfinished Prisma migration is visible.

# iБюро — Guarded staging migration deploy

This runbook describes the only repository-supported command for applying already-reviewed Prisma migrations to the **staging** database.

## Preconditions

Before running anything that mutates a database:

1. Run `npm run db:inspect:baseline` against the authoritative database and archive its structural fingerprint.
2. Confirm a current backup/snapshot exists.
3. Generate migration SQL from the reviewed Prisma schema.
4. Run `npm run db:review:sql` for every migration SQL file.
5. Perform manual engineering review of the SQL.
6. Confirm the target is a disposable/recoverable staging environment, never production.

## Command

The guarded command is:

```bash
npm run db:deploy:staging
```

It requires all of the following environment variables:

```text
DATABASE_URL=<staging PostgreSQL connection string>
IB_DB_TARGET=staging
IB_STAGING_DATABASE_NAME=<exact current_database() value>
IB_STAGING_MIGRATION_CONFIRM=MIGRATE:<exact database name>
```

The script first connects to PostgreSQL and verifies that `current_database()` exactly matches `IB_STAGING_DATABASE_NAME`. It then requires the explicit confirmation token derived from that exact database name.

Only after those checks pass does it execute:

```text
prisma migrate deploy
```

## What this command does not do

It does **not**:

- create migration files;
- run `prisma migrate dev`;
- run `prisma db push`;
- automatically accept destructive SQL;
- bypass the migration SQL review gate;
- target production by design.

## After a successful staging migration

Run, in order:

```text
npm run check:staging
npm run check:staging:authz
```

Then execute DB-backed authenticated E2E scenarios for CLIENT, LAWYER and MANAGER before any production rollout is discussed.

## Production rule

There is intentionally no `db:deploy:production` script in this repository. Production migration requires an explicit release procedure, reviewed exact migration set, backup verification and a separate approval decision.

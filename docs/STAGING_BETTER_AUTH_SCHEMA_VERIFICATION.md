# Staging Better Auth schema verification

`npm run check:staging:auth-schema` is a read-only production-readiness gate for the Better Auth PostgreSQL schema.

It does **not** create, alter, migrate or delete database objects. It starts `BEGIN READ ONLY`, reads PostgreSQL catalogs / `information_schema`, prints only structural results, and ends with `ROLLBACK`.

## Required environment

```text
DATABASE_URL=...
IB_DB_TARGET=staging
IB_STAGING_DATABASE_NAME=<exact staging database name>
IB_STAGING_BETTER_AUTH_SCHEMA=<exact schema used by Better Auth, normally public unless search_path is configured>
```

The command refuses to run unless `IB_DB_TARGET` is exactly `staging`, the connected database name matches `IB_STAGING_DATABASE_NAME`, and PostgreSQL `current_schema()` matches `IB_STAGING_BETTER_AUTH_SCHEMA`.

## What is verified

Because the current iБюро Better Auth configuration does not customize model/table names, the verifier expects the default Better Auth core tables:

- `user`
- `session`
- `account`
- `verification`

The enabled two-factor plugin also requires:

- `user.twoFactorEnabled`
- `twoFactor`

The verifier checks the runtime-critical columns used by Better Auth 1.7, primary keys on `id`, unique access paths for `user.email`, `session.token`, and `account(issuer, accountId)`, plus the `userId -> user.id` foreign keys for `session`, `account`, and `twoFactor`.

It also emits a SHA-256 fingerprint made only from schema metadata (column definitions, indexes and constraints). No user, session, credential, TOTP secret, backup code, email or other payload row is read.

## Safety rules

This verifier is intentionally separate from migration execution.

Do not use any of the following against production without a separately reviewed release procedure and explicit approval:

- `npx auth migrate`
- programmatic Better Auth `runMigrations()`
- `prisma db push`
- unreviewed SQL

If the verifier fails because Better Auth objects are missing or stale, the next step is to **generate/review** the required staging schema change. A failure is not permission to auto-migrate the database.

## Recommended staging order

1. `npm run db:inspect:baseline`
2. review the authoritative staging/database baseline
3. `npm run db:verify:staging` after reviewed Prisma migrations are applied
4. `npm run check:staging:auth-schema`
5. provision staging `AuthIdentity` fixtures
6. `npm run check:staging:authz`
7. authenticated HTTP authorization/mutation smoke tests

A green CI build proves that this verifier compiles; it does not prove a remote staging database has passed the verifier until the command is executed with staging credentials.

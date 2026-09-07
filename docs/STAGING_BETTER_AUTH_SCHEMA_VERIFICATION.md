# Staging Better Auth schema verification

`npm run check:staging:auth-schema` is a read-only production-readiness gate for the Better Auth PostgreSQL provider schema.

It does **not** create, alter, migrate or delete database objects. It starts `BEGIN READ ONLY`, reads PostgreSQL catalogs / `information_schema`, prints only structural results, and ends with `ROLLBACK`.

## Required environment

```text
DATABASE_URL=...
IB_DB_TARGET=staging
IB_STAGING_DATABASE_NAME=<exact staging database name>
IB_STAGING_BETTER_AUTH_SCHEMA=<exact schema used by Better Auth, normally public unless search_path is configured>
```

The command refuses to run unless `IB_DB_TARGET` is exactly `staging`, the connected database name matches `IB_STAGING_DATABASE_NAME`, and PostgreSQL `current_schema()` matches `IB_STAGING_BETTER_AUTH_SCHEMA`.

## Provider schema ownership

The lowercase Better Auth tables are provider-owned infrastructure and remain conceptually separate from the legal-domain Prisma models. The application uses Better Auth's built-in PostgreSQL/Kysely adapter through `pg.Pool`; the repository does not partially mirror those provider tables in `prisma/schema.prisma`.

Any future provider schema SQL must therefore be generated for the pinned Better Auth configuration, compared with the authoritative PostgreSQL baseline, manually reviewed, and applied only through an explicitly approved staging procedure. A green verifier is evidence of schema compatibility, not permission to auto-migrate.

## What is verified

Because the current iБюро Better Auth configuration does not customize provider table names, the verifier expects the Better Auth 1.7 physical core tables:

- `user`
- `session`
- `account`
- `verification`

The enabled two-factor plugin adds:

- `user.twoFactorEnabled`
- `twoFactor`

Database-backed distributed rate limiting additionally requires:

- `rateLimit`

The verifier requires the complete physical Better Auth 1.7 core columns, including nullable-but-present fields such as:

- `user.image`;
- `session.ipAddress` and `session.userAgent`;
- `account.accessToken`, `refreshToken`, token expiry fields, `scope`, `idToken` and `password`;
- `verification.createdAt` and `verification.updatedAt`.

For 2FA it also requires the current lockout fields `verified`, `failedVerificationCount` and `lockedUntil`. For database rate limiting it requires `id`, unique `key`, `count` and bigint-compatible `lastRequest`.

The verifier checks:

- required physical columns for all six provider tables;
- compatible string/boolean/timestamp/integer PostgreSQL types;
- primary keys on `id`;
- unique access paths for `user.email`, `session.token`, `account(issuer, accountId)` and `rateLimit.key`;
- `userId -> user.id` foreign keys for `session`, `account` and `twoFactor`.

It emits a SHA-256 fingerprint made only from schema metadata (column definitions, indexes and constraints). No user, session, credential, password, TOTP secret, backup code, email, OAuth token or other provider data row is read.

## Safety rules

This verifier is intentionally separate from migration execution.

Do not use any of the following against production without a separately reviewed release procedure and explicit approval:

- `npx auth migrate`;
- programmatic Better Auth `runMigrations()`;
- `prisma db push`;
- unreviewed SQL.

If the verifier fails because Better Auth objects are missing or stale, the next step is to **generate and review** the provider schema change. A failure is not permission to auto-migrate the database.

## Recommended staging order

1. `npm run db:inspect:baseline`
2. review the authoritative staging/database baseline and backup/restore readiness
3. review the legal-domain Prisma migration plan and Better Auth provider schema plan independently
4. apply only explicitly reviewed staging database changes
5. `npm run db:verify:staging`
6. `npm run check:staging:auth-schema`
7. provision controlled staging `AuthIdentity` fixtures
8. `npm run check:staging:authz`
9. authenticated HTTP authorization/mutation/rate-limit smoke tests

A green CI build proves that this verifier and its static contract compile; it does not prove a remote staging database has passed until the command is executed with staging credentials.

# iБюро — AuthIdentity provisioning

Production authorization never trusts the Better Auth subject as the internal application user id. Every verified external identity must be explicitly linked to an existing active `User` row through `AuthIdentity`.

## Invariant

```text
Better Auth verified session
  -> provider + subject
  -> AuthIdentity(provider, subject)
  -> internal User.id
  -> ACTIVE User + UserRole/Role
  -> AuthenticatedActor
```

Email matching is intentionally not part of runtime authorization and must not be used as an implicit fallback.

## Staging-only provisioning command

During production-readiness work, identity provisioning is intentionally exposed only as a staging command:

```bash
npm run auth:link:staging
```

It requires the normal staging database identity guard:

- `IB_DB_TARGET=staging`
- `IB_STAGING_DATABASE_HOST`
- `IB_STAGING_DATABASE_NAME`
- `IB_STAGING_DATABASE_USER`
- matching `DATABASE_URL`

The URL identity is validated before any DB-backed provisioning logic runs.

The command additionally requires:

- `IB_AUTH_LINK_USER_ID` — existing internal `User.id`;
- `IB_AUTH_LINK_SUBJECT` — verified Better Auth user subject;
- optional `IB_AUTH_LINK_PROVIDER` — defaults to `better-auth`;
- `IB_AUTH_LINK_CONFIRM=LINK:<IB_AUTH_LINK_USER_ID>`.

Example shape only; never commit real values:

```bash
IB_AUTH_LINK_USER_ID=<internal-uuid> \
IB_AUTH_LINK_SUBJECT=<verified-better-auth-subject> \
IB_AUTH_LINK_CONFIRM=LINK:<internal-uuid> \
npm run auth:link:staging
```

## Safety properties

- staging target identity fails closed before the provisioning call;
- the target internal user must already exist and be `ACTIVE`;
- an existing `(provider, subject)` mapping to the same user is idempotent;
- a mapping conflict fails closed with `AUTH_IDENTITY_PROVISIONING_CONFLICT`;
- the command does not create users, roles or cases;
- no public HTTP provisioning endpoint exists;
- browser-supplied user ids or roles are never trusted;
- the CLI success marker does not echo the external subject or mapping details.

A separate production provisioning procedure must not be introduced or used without an explicit production release decision, verified backup/baseline, and production-specific safeguards.

## Staging activation sequence

1. Establish staging PostgreSQL baseline and reviewed migrations.
2. Create/verify the internal `User` and roles.
3. Create the Better Auth account through controlled enrollment.
4. Obtain the verified Better Auth subject from trusted server/admin tooling.
5. Run `npm run auth:link:staging` with the explicit confirmation token.
6. Sign in through Better Auth and verify session -> `AuthIdentity` -> internal actor resolution.
7. Run cross-role authorization E2E before enabling real client data.

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

## Controlled staging account bootstrap

Public Better Auth email/password signup is disabled in the application. The first staging credential account for an existing internal user must therefore be created through the guarded CLI bootstrap rather than by temporarily enabling a public signup route.

Use:

```bash
npm run auth:bootstrap:staging
```

Required values:

- normal staging DB identity variables and `IB_RUNTIME_TARGET=staging`;
- the pinned reviewed migration-history fingerprint;
- `IB_STAGING_BETTER_AUTH_SCHEMA=public`;
- valid staging `BETTER_AUTH_SECRET` and non-production `BETTER_AUTH_URL`;
- `IB_AUTH_BOOTSTRAP_USER_ID` — existing internal `User.id`;
- `IB_AUTH_BOOTSTRAP_EMAIL` — credential email; if the internal User already has an email it must match;
- `IB_AUTH_BOOTSTRAP_PASSWORD` — 12–128 characters;
- `IB_AUTH_BOOTSTRAP_CONFIRM=BOOTSTRAP-AUTH:<staging-database-name>:<IB_AUTH_BOOTSTRAP_USER_ID>`.

The command is staging-only and has no HTTP/admin endpoint. It:

1. passes the reviewed staging mutation preflight before creating its operational DB pool;
2. requires the internal user to exist and remain `ACTIVE`;
3. refuses to overwrite/reuse an existing Better Auth email;
4. creates the credential account through a dedicated CLI-only Better Auth instance using the reviewed password policy and `autoSignIn=false`;
5. re-reads the persisted Better Auth row and requires its real subject to match the signup result, preventing a synthetic duplicate/race response from being linked;
6. links that subject to the internal user through `AuthIdentity`;
7. deletes only the newly created Better Auth account if the domain identity link fails before commit;
8. never prints the password, email, Better Auth subject or connection string.

For LAWYER and MANAGER accounts, complete TOTP enrollment through the normal application flow before the staging auth-flow verifier is run. Do not enable trusted-device bypass for staff fixtures.

## Staging-only recovery/link command

`auth:link:staging` remains available for the narrower recovery case where a verified Better Auth subject already exists and must be linked to an existing active internal user:

```bash
npm run auth:link:staging
```

It requires the normal staging database identity guard plus:

- `IB_AUTH_LINK_USER_ID` — existing internal `User.id`;
- `IB_AUTH_LINK_SUBJECT` — verified Better Auth user subject;
- optional `IB_AUTH_LINK_PROVIDER` — defaults to `better-auth`;
- `IB_AUTH_LINK_CONFIRM=LINK:<staging-database-name>:<IB_AUTH_LINK_USER_ID>`.

Example shape only; never commit real values:

```bash
IB_AUTH_LINK_USER_ID=<internal-uuid> \
IB_AUTH_LINK_SUBJECT=<verified-better-auth-subject> \
IB_AUTH_LINK_CONFIRM=LINK:<staging-database-name>:<internal-uuid> \
npm run auth:link:staging
```

The CLI is intentionally executed with Node's `react-server` condition so the application-level `server-only` boundary remains enforced while trusted administrative tooling can import the server provisioning module.

## Safety properties

- staging target identity fails closed before provisioning;
- the target internal user must already exist and be `ACTIVE`;
- an existing `(provider, subject)` mapping to the same user is idempotent in the recovery linker;
- a mapping conflict fails closed with `AUTH_IDENTITY_PROVISIONING_CONFLICT`;
- neither command creates roles or cases;
- no public HTTP provisioning endpoint exists;
- browser-supplied user ids or roles are never trusted;
- success markers do not echo external subjects or mapping details.

A production provisioning procedure must not be introduced or used without an explicit production release decision, verified backup/baseline, and production-specific safeguards.

## Staging activation sequence

1. Establish staging PostgreSQL baseline and reviewed domain migration.
2. Apply and structurally verify the reviewed Better Auth schema.
3. Create/verify the internal `User` and roles.
4. Run `npm run auth:bootstrap:staging` for each new controlled staging credential account.
5. For LAWYER/MANAGER, enroll TOTP and store the dedicated staging fixture secret through the approved secret-management path.
6. Use `auth:link:staging` only when recovering/linking an already-existing verified Better Auth subject.
7. Sign in through Better Auth and verify session -> `AuthIdentity` -> internal actor resolution.
8. Run the CLIENT/LAWYER/MANAGER auth-flow and cross-role authorization E2E gates before enabling real client data.

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

## Guarded provisioning command

The repository exposes:

```bash
npm run auth:link
```

The command requires all of the following:

- `DATABASE_URL`
- `IB_AUTH_LINK_USER_ID` — existing internal `User.id`
- `IB_AUTH_LINK_SUBJECT` — verified Better Auth user subject
- optional `IB_AUTH_LINK_PROVIDER` — defaults to `better-auth`
- `IB_AUTH_LINK_CONFIRM=LINK:<IB_AUTH_LINK_USER_ID>`

Example shape only (do not commit real values):

```bash
IB_AUTH_LINK_USER_ID=<internal-uuid> \
IB_AUTH_LINK_SUBJECT=<verified-better-auth-subject> \
IB_AUTH_LINK_CONFIRM=LINK:<internal-uuid> \
npm run auth:link
```

## Safety properties

- the target internal user must already exist and be `ACTIVE`;
- an existing `(provider, subject)` mapping to the same user is idempotent;
- an existing `(provider, subject)` mapping to a different user fails closed with `AUTH_IDENTITY_PROVISIONING_CONFLICT`;
- the command does not create users, roles or cases;
- no public HTTP provisioning endpoint exists;
- do not derive the link from browser-supplied user ids or roles;
- do not use this against production until database baseline, backup and migration history are confirmed.

## Staging activation sequence

1. Establish staging PostgreSQL baseline and reviewed migrations.
2. Create/verify the internal `User` and its internal roles.
3. Create the Better Auth account using the controlled enrollment flow.
4. Obtain the verified Better Auth subject from trusted server/admin tooling.
5. Run `npm run auth:link` with the explicit confirmation token.
6. Sign in through Better Auth and verify that the session resolves through `AuthIdentity` to the expected internal actor.
7. Run cross-role authorization E2E before enabling real client data.

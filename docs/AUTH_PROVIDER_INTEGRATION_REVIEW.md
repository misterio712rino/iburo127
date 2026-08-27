# Auth Provider Integration Review

## Status

Architecture checkpoint only. No authentication library is selected or installed by this change, no production endpoint is activated, and no database migration is applied.

## Goal

Keep application authorization independent from the eventual login/session vendor. The application must receive an internal `User.id`; it must never trust a browser-supplied user id, role, case id, email, or external provider subject as authorization evidence.

## Boundary

The provider-neutral path is:

```text
Auth vendor / signed session
        ↓
ExternalSessionReader
        ↓
ExternalAuthIdentity { provider, subject }
        ↓
AuthIdentityResolver
        ↓
internal User.id
        ↓
MappedSessionProvider
        ↓
SessionProvider / AuthSession
        ↓
PrismaActorRepository
        ↓
ACTIVE User + database roles
        ↓
AuthenticatedActor
```

`server/auth/provider-boundary.ts` implements the provider-neutral composition up to `SessionProvider`.

## Security invariants

1. `ExternalSessionReader` must only return an identity after the eventual auth library has cryptographically validated the session/cookie/token.
2. `subject` is an opaque provider identifier. It is not an iБюро `User.id` unless a trusted database mapping explicitly says so.
3. Email must not be used as a runtime authorization key or as an implicit identity mapping fallback.
4. Roles are never accepted from the provider/browser for case authorization. Roles continue to come from `UserRole -> Role` in PostgreSQL.
5. Suspended or missing users remain rejected by `PrismaActorRepository` even when an external session is valid.
6. Demo identity/localStorage must never implement `ExternalSessionReader` for production routes.
7. Route handlers must receive a server-side `SessionProvider`; they must not construct an actor from request JSON, query parameters, or headers supplied by the client.

## Database implication

The current schema has `User` but no durable mapping between an external authentication provider subject and `User.id`. Before activating a real provider, introduce a dedicated mapping entity rather than overloading `User.email`.

Recommended logical shape (not yet a Prisma migration):

```text
AuthIdentity
- id UUID
- userId -> User.id
- provider
- subject
- createdAt
- updatedAt
- unique(provider, subject)
- index(userId)
```

Depending on the selected provider, optional metadata such as verified email may be stored for account-management workflows, but it must not replace `(provider, subject)` as the stable authentication identity.

## Provider selection criteria

Before selecting Auth.js, Clerk, a custom PostgreSQL session implementation, or another provider, explicitly evaluate:

- deployment compatibility with Next.js 16 / Vercel;
- support for secure HttpOnly/SameSite cookies and session revocation;
- PostgreSQL-backed identity/session needs;
- credentials/passwordless/social-login requirements;
- account recovery and MFA requirements;
- Russian/CIS operational and privacy constraints relevant to the product;
- vendor lock-in and ability to retain internal `User.id` as the application identity;
- auditability and administrative suspension behavior.

## Activation sequence

1. Select the real auth provider deliberately.
2. Implement `ExternalSessionReader` for that provider.
3. Add and review the durable `AuthIdentity` mapping schema.
4. Implement `AuthIdentityResolver` using PostgreSQL.
5. Validate session -> internal user -> actor -> case authorization end to end.
6. Only then mount production `/api/...` or server-action questionnaire endpoints.
7. Keep demo identity isolated from the production route tree.

## Current decision

Do not add an auth dependency yet. The existing questionnaire backend can remain provider-neutral while the product requirements for login, recovery, MFA, hosting, and operational constraints are decided.

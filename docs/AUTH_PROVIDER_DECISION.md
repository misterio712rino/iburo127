# iБюро — Auth Provider Decision

Status: APPROVED ARCHITECTURAL DIRECTION
Branch: `audit/production-readiness`

## Decision

Use **Better Auth** as the preferred concrete authentication/session layer for the production application, while keeping iБюро authorization and legal-case access in the existing internal PostgreSQL domain (`User`, `UserRole`, `Role`, `ClientCase`).

This decision does **not** make Better Auth roles, browser claims, email addresses or provider metadata an authorization source.

## Why this direction

The application needs a production authentication layer that:

- works with Next.js App Router / Next.js 16;
- can be self-hosted with the application's PostgreSQL infrastructure;
- supports server-side session validation;
- supports email/password, recovery and verification flows;
- supports TOTP/OTP two-factor authentication and backup codes;
- does not require the legal domain to depend on a third-party SaaS identity database as the source of truth;
- can be integrated behind the already implemented `ExternalSessionReader -> AuthIdentityResolver -> SessionProvider` boundary.

Better Auth's current documentation provides a native Next.js integration, direct PostgreSQL support, session management and a 2FA plugin with TOTP/OTP, backup codes and trusted-device support.

## Rejected as primary direction

### Clerk

Technically strong and very convenient for Next.js, but it makes production authentication depend on an external hosted identity service. That is not the preferred default for a Russian legal-data product when the application already has its own PostgreSQL identity and authorization model.

### Supabase Auth

Also technically capable, but would couple authentication to a Supabase-managed auth schema/service unless self-hosting and operational ownership are introduced. iБюро already has a managed PostgreSQL architecture and Prisma domain model, so adding another data platform is unnecessary.

### Browser/demo identity

Explicitly prohibited for production. `DemoIdentityProvider` and localStorage identity selection remain presentation-only.

## Integration architecture

```text
Better Auth verified server session
        ↓
ExternalSessionReader
        ↓
ExternalAuthIdentity { provider, subject }
        ↓
PrismaAuthIdentityResolver
        ↓
internal User.id
        ↓
PrismaActorRepository
        ↓
ACTIVE User + UserRole/Role
        ↓
AuthenticatedActor
        ↓
ClientCase/domain authorization
```

Provider identifier should be stable, for example `better-auth`.

The Better Auth user/session identifier must be stored in the existing `AuthIdentity` mapping and must never be treated as the internal legal-domain `User.id` without that mapping.

## Security rules

1. Authentication proves identity; authorization remains internal.
2. Never authorize by email address.
3. Never authorize by client-supplied role, `userId`, `caseId` ownership or tariff.
4. A valid Better Auth session for a suspended/archived internal user does not grant platform access.
5. Staff MFA should be mandatory before production launch.
6. Client MFA should be supported and can be required based on the final risk policy.
7. Recovery must not silently bypass MFA or account-linking controls.
8. Session cookies must be secure, HTTP-only and same-site configured for the deployment topology.
9. Auth tables and legal-domain tables must remain conceptually separate even when stored in the same PostgreSQL cluster.
10. Do not run Better Auth auto-migrations directly against production; generate/review SQL and include it in the controlled database migration plan.

## Implementation order

1. Establish authoritative PostgreSQL baseline and backup.
2. Add Better Auth dependency in a controlled package-lock update.
3. Configure Better Auth server instance with PostgreSQL.
4. Add Next.js auth route handler.
5. Implement trusted `ExternalSessionReader` using the verified Better Auth server session.
6. Add sign-in, sign-out, recovery and MFA screens.
7. Provision/link `AuthIdentity` records explicitly.
8. Wire authenticated platform routes to `requireServerActor`.
9. Switch workflow UI adapters from demo storage to authenticated server endpoints one workflow at a time.
10. Run cross-role security E2E before any production enablement.

## External prerequisites

The repository can be prepared without secrets, but final activation requires:

- production/staging `DATABASE_URL`;
- Better Auth secret configuration;
- email delivery provider for verification/recovery/OTP if enabled;
- production hostname/cookie policy;
- controlled initial account provisioning/linking.

Until these prerequisites are configured, the current investor demo remains the only active presentation path.

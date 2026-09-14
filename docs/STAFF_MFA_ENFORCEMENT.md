# Staff MFA enforcement

Production staff roles (`LAWYER`, `MANAGER`) must have Better Auth TOTP enabled before the provider-neutral platform session is admitted.

## Enforcement boundary

1. Better Auth verifies the session server-side.
2. `AuthIdentity(provider, subject)` maps the Better Auth subject to the internal `User`.
3. Internal roles are loaded server-side.
4. `StaffMfaEnforcingSessionProvider` admits `CLIENT` sessions without mandatory MFA, but rejects `LAWYER`/`MANAGER` when Better Auth `user.twoFactorEnabled !== true`.
5. All platform domain routes continue to consume `SessionProvider`; browser role/user/case values are not used for authorization.

A rejected staff session appears unauthenticated to platform APIs. The `/portal` layout uses the non-admitted enrollment-state resolver to redirect an authenticated staff user to `/auth/mfa-enroll` instead of exposing platform data.

## Enrollment

`/auth/mfa-enroll` is available only to an authenticated mapped staff identity that still requires MFA.

The flow:

1. re-authenticates the Better Auth credential by requiring the current password;
2. calls Better Auth `twoFactor.enable({ method: "totp" })`;
3. displays the TOTP URI/manual secret and one-time backup codes only in browser memory;
4. requires a six-digit TOTP verification;
5. uses `trustDevice: false`;
6. returns to `/portal`, where server-side MFA admission is re-evaluated.

The TOTP URI, secret, backup codes, password and cookies must never be logged or committed.

## Staging verification

The existing authenticated staging HTTP authorization harness becomes an enforcement proof for staff: a LAWYER or MANAGER cookie can reach platform APIs only when the mapped internal role is valid and Better Auth reports MFA enabled.

Actual staging verification still depends on Better Auth staging tables/fixtures and valid staging session cookies. No production migration or Better Auth auto-migration is authorized by this implementation.

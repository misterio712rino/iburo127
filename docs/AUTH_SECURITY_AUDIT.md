# Authentication security audit trail

Status: code-level foundation only. The `UserSecurityEvent` table has not been migrated to staging or production by this work.

## Purpose

Authentication security events are user-scoped security records and must not be attached to an arbitrary `ClientCase`.

The audit model deliberately stores only:

- internal `User.id`;
- controlled event type;
- server timestamp.

It does **not** store email, phone, password, TOTP/backup code, reset token, session token, IP address, user agent, Better Auth subject, request body or case data.

## Event taxonomy

The current controlled taxonomy is:

- `auth.sign_in.success`;
- `auth.mfa.totp_verified`;
- `auth.mfa.backup_code_used`;
- `auth.password_reset.requested`;
- `auth.password_reset.completed`.

Failed-password / failed-MFA attempt telemetry is not claimed by this foundation. Better Auth has its own 2FA lockout controls, but a complete security-observability design for failed attempts still requires an approved privacy/retention policy and operational logging/alerting destination.

## Identity boundary

Better Auth's user id is **not** stored in `UserSecurityEvent`.

The recorder resolves the external identity through the existing authoritative mapping:

```text
(provider = better-auth, subject = Better Auth user id)
  -> AuthIdentity
  -> internal User.id
  -> UserSecurityEvent.userId
```

Email matching is deliberately unsupported.

If an external subject has no `AuthIdentity` mapping, no user-scoped event is written because the system cannot safely infer the internal user.

## Better Auth lifecycle wiring

The server uses Better Auth lifecycle callbacks/hooks rather than trusting browser success messages.

### Email/password sign-in

`/sign-in/email` is recorded as `auth.sign_in.success` only when Better Auth exposes a newly created session.

For a user with 2FA enabled, Better Auth can return a second-factor challenge without a completed session. That intermediate password step is therefore **not** recorded as a completed sign-in.

### TOTP

A successful `/two-factor/verify-totp` records `auth.mfa.totp_verified`.

When that verification also creates the new authenticated session, it additionally records `auth.sign_in.success`.

This same event type also covers successful verification used to finish TOTP enrollment; it does not store whether the submitted six-digit code came from a sign-in or enrollment UI.

### Backup code

A successful `/two-factor/verify-backup-code` records `auth.mfa.backup_code_used`.

When it creates the new authenticated session, it additionally records `auth.sign_in.success`.

The backup code itself is never stored.

### Password reset

The Better Auth `sendResetPassword` callback schedules `auth.password_reset.requested` only for the provider user Better Auth resolved for the reset flow.

The Better Auth `onPasswordReset` callback schedules `auth.password_reset.completed` only after a successful password reset.

The reset token, password and email are never passed to the security-audit recorder.

## Failure semantics

Security event persistence is secondary work after Better Auth has already accepted or changed authentication state.

The repository therefore uses the existing non-blocking post-response pattern:

1. Better Auth performs the authentication/recovery operation;
2. a minimal event is scheduled through Next.js `after()`;
3. the recorder resolves `AuthIdentity` and writes `UserSecurityEvent`;
4. recorder/configuration/scheduler failures are swallowed without logging raw runtime details.

This avoids a dangerous state where a session or password reset succeeds in the auth database but the HTTP response becomes retriable because a secondary audit insert failed.

This choice means the audit trail is **best-effort after the successful auth state change**, not a transactional exactly-once ledger. Do not describe it as exactly-once authentication auditing.

## Database boundary

`prisma/schema.prisma` now contains `UserSecurityEvent`, and the staging schema verifier requires it as part of the production domain schema.

No migration was generated or applied because authoritative Prisma migration history is still an external release blocker. The table must enter the reviewed migration SQL together with the rest of the authoritative schema changes.

Before runtime activation:

1. establish and review authoritative migration history;
2. generate/review SQL containing `UserSecurityEvent`;
3. apply only through the guarded staging migration path;
4. run `npm run db:verify:staging`;
5. provision mapped staging identities;
6. perform successful password, TOTP, backup-code and password-reset flows;
7. verify event rows by `User.id` without reading/storing auth secrets;
8. verify an unmapped Better Auth subject does not create a guessed/mis-attributed event;
9. approve retention/deletion policy;
10. define operational alerting for audit-write failures or other auth anomalies before production approval.

No production database mutation or Better Auth auto-migration is authorized by this document.

# Authentication email recovery — Yandex Cloud Postbox

## Scope

The audit branch uses Yandex Cloud Postbox as the transactional email transport for Better Auth password recovery and email-verification links.

Self-sign-up remains disabled. Email verification delivery is wired, but mandatory email verification is **not enabled** until existing staging identities and delivery are verified.

## Security properties

- Separate `YANDEX_POSTBOX_*` credentials are required; Object Storage credentials are not reused.
- The Postbox service account should have only the permissions required to send mail (`postbox.sender`).
- Static access keys stay outside the repository.
- AWS Signature Version 4 is implemented with Node `crypto`; the implementation is regression-tested against the published AWS IAM SigV4 example signature.
- Password-reset delivery callbacks return without awaiting the provider call, following Better Auth guidance to reduce account-enumeration timing differences.
- Delivery failures log only the constant `AUTH_EMAIL_DELIVERY_FAILED`; recipient address, token and recovery URL are never logged.
- Recovery URLs are rejected unless their origin exactly matches `BETTER_AUTH_URL`.
- Password reset revokes existing sessions through Better Auth `revokeSessionsOnPasswordReset: true`.

## Required environment

```text
YANDEX_POSTBOX_FROM_EMAIL=<verified Postbox sender>
YANDEX_POSTBOX_ACCESS_KEY_ID=<dedicated static key id>
YANDEX_POSTBOX_SECRET_ACCESS_KEY=<dedicated static key secret>
```

The endpoint and signing scope are fixed in code:

```text
endpoint=https://postbox.cloud.yandex.net
region=ru-central1
service=ses
```

## Staging activation gate

Before calling recovery production-ready:

1. Create/verify the sender in Yandex Cloud Postbox.
2. Create a dedicated service account with the minimum sending role.
3. Store credentials in the staging secret store, not in source control.
4. Exercise `/auth/forgot-password` with an actual staging account.
5. Verify receipt, link origin, token handling and successful password reset.
6. Verify old sessions are revoked after reset.
7. Exercise invalid/expired links and confirm no internal error text or token is exposed.
8. Verify delivery/error logs contain no recipient address, token or URL.
9. Only after existing staging accounts are reviewed, decide whether to enable mandatory email verification.

A green repository CI run proves the transport, UI and SigV4 test compile and build. It does **not** prove that Yandex Cloud accepted or delivered a real message.

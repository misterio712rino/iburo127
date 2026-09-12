# Authentication email recovery — Yandex Cloud Postbox

## Scope

The audit branch uses Yandex Cloud Postbox as the transactional email transport for Better Auth password recovery and email-verification links.

Self-sign-up remains disabled. Email verification delivery is wired, but mandatory email verification is **not enabled** until existing staging identities and delivery are verified.

## Security properties

- Separate `YANDEX_POSTBOX_*` credentials are required; Object Storage credentials are not reused.
- The Postbox service account should have only the permissions required to send mail (`postbox.sender`).
- Static access keys stay outside the repository.
- AWS Signature Version 4 is implemented with Node `crypto`; the implementation is regression-tested against the published AWS IAM SigV4 example signature.
- Password-reset and verification callbacks do not await provider delivery, following Better Auth guidance to reduce account-enumeration timing differences.
- Delivery is scheduled through stable Next.js `after()` so supported Node/Docker runtimes, and serverless adapters that implement the required `waitUntil` primitive, keep the request lifetime open for the background send without delaying the authentication response.
- Provider/network failures inside the scheduled task are swallowed at the authentication boundary and are not written directly to console/stdout/stderr. Recipient address, token and recovery URL are never logged by this transport. Delivery health must be verified through the staging exercise and provider-side monitoring before production enablement.
- Postbox requests use a bounded timeout and normalize runtime failures to non-PII delivery codes rather than exposing raw network/provider exception text.
- Recovery URLs are rejected unless their origin exactly matches `BETTER_AUTH_URL`.
- Password reset revokes existing sessions through Better Auth `revokeSessionsOnPasswordReset: true`.

## Required environment

```text
YANDEX_POSTBOX_FROM_EMAIL=<verified Postbox sender>
YANDEX_POSTBOX_ACCESS_KEY_ID=<dedicated static key id>
YANDEX_POSTBOX_SECRET_ACCESS_KEY=<dedicated static key secret>
YANDEX_POSTBOX_REQUEST_TIMEOUT_MS=10000
```

The endpoint and signing scope are fixed in code:

```text
endpoint=https://postbox.cloud.yandex.net
region=ru-central1
service=ses
```

## Deployment-runtime requirement

The current App Router auth endpoint runs Better Auth inside a Next.js Route Handler. Background email dispatch uses `after()` rather than an untracked `void` promise.

Before recovery can be called production-ready, the selected deployment runtime must be confirmed to support `after()` semantics. Next.js supports it directly on its Node.js server and Docker runtime. A custom/serverless adapter must supply a compatible `waitUntil` implementation so the invocation remains alive until the scheduled promise settles.

A platform that cannot provide this guarantee must not be used for production auth email delivery without replacing the dispatcher with a durable queue/outbox worker.

## Staging activation gate

Before calling recovery production-ready:

1. Create/verify the sender in Yandex Cloud Postbox.
2. Create a dedicated service account with the minimum sending role.
3. Store credentials in the staging secret store, not in source control.
4. Run the dedicated hardcoded simulator gate documented in `docs/STAGING_POSTBOX_VERIFICATION.md`.
5. Exercise `/auth/forgot-password` with an actual staging account through the intended staging deployment runtime.
6. Verify receipt, link origin, token handling and successful password reset.
7. Verify old sessions are revoked after reset.
8. Exercise invalid/expired links and confirm no internal error text or token is exposed.
9. Verify application runtime output contains no recipient address, token or recovery URL and review provider-side delivery metrics/errors.
10. Verify that the deployed runtime actually completes `after()` work after the HTTP response is returned.
11. Only after existing staging accounts are reviewed, decide whether to enable mandatory email verification.

A green repository CI run proves the dispatcher, transport, UI and local tests compile and build. It does **not** prove that the selected deployment adapter preserves background work or that Yandex Cloud accepted/delivered a real staging message.

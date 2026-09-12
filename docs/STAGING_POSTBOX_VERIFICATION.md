# iБюро — Staging Postbox Delivery Verification

Purpose: verify the real Yandex Cloud Postbox transport in staging without sending mail to a real user.

## Safety boundary

This command is an active provider-side send. It is intentionally **not** part of the read-only `check:staging` or `check:staging:release` aggregates.

The verifier is fail-closed and requires all of the following before any request is sent:

```text
IB_EMAIL_TARGET=staging
YANDEX_POSTBOX_FROM_EMAIL=<dedicated staging sender>
IB_STAGING_POSTBOX_FROM_EMAIL=<same exact staging sender>
YANDEX_POSTBOX_ACCESS_KEY_ID=<dedicated staging static access key id>
IB_STAGING_POSTBOX_ACCESS_KEY_ID=<same exact staging access key id>
IB_STAGING_POSTBOX_CONFIRM=SIMULATOR:<IB_STAGING_POSTBOX_FROM_EMAIL>
```

`YANDEX_POSTBOX_SECRET_ACCESS_KEY` must belong to the same dedicated staging static key. Never substitute production sender credentials.

The recipient is hardcoded in source to the Yandex Cloud Postbox delivery simulator:

```text
success@simulator.pstbx.ru
```

It cannot be overridden through environment variables or command-line input. Therefore the verifier cannot be redirected to a client or staff mailbox without a source-code change and normal CI review.

## Runtime timeout and error handling

Application delivery uses `YANDEX_POSTBOX_REQUEST_TIMEOUT_MS` with a default of 10000 ms. Production configuration accepts only 1000–30000 ms.

The transport does not expose raw fetch/provider exception text. Runtime failures are normalized to bounded non-PII codes:

```text
EMAIL_DELIVERY_FAILED:TIMEOUT
EMAIL_DELIVERY_FAILED:NETWORK
EMAIL_DELIVERY_FAILED:HTTP_<status>
```

Request payloads, credentials, recipients, provider response bodies, and raw network exception messages are not logged by the transport.

## Execute the staging simulator check

1. Configure a dedicated staging Postbox sender and service account/static access key.
2. Ensure the service account has the Yandex Cloud role required for Postbox sending and belongs to the same folder as the sender identity.
3. Set the explicit confirmation token for this single check:

```text
IB_STAGING_POSTBOX_CONFIRM=SIMULATOR:<IB_STAGING_POSTBOX_FROM_EMAIL>
```

4. Run:

```bash
npm run check:staging:email-delivery
```

Expected marker:

```text
STAGING_POSTBOX_VERIFY_PASS
```

5. Clear `IB_STAGING_POSTBOX_CONFIRM` immediately after the check.

A green repository CI proves only that the verifier and transport compile and their local tests pass. The remote Yandex Cloud Postbox staging sender is not verified until this command is actually run with dedicated staging credentials.

This procedure does not authorize production deployment, production credentials, production mail delivery, merging to `main`, or any production database/storage mutation.

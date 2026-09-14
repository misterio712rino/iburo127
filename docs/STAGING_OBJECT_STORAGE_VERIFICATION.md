# Staging private Object Storage verification

`npm run check:staging:storage` is a read-only production-readiness gate for the private Yandex Object Storage staging bucket.

The verifier uses the same S3-compatible endpoint and static-key credential shape as the application. It performs bucket-metadata requests only. It does **not** list objects, download objects, upload objects, delete objects, generate signed URLs, or modify ACL/policy/CORS.

## Required environment

```text
IB_STORAGE_TARGET=staging
IB_STAGING_STORAGE_BUCKET=<exact staging bucket name>
IB_STAGING_STORAGE_ALLOWED_ORIGIN=https://<exact staging app origin>
IB_STAGING_STORAGE_ACCESS_KEY_ID=<exact staging static-key id>
YANDEX_STORAGE_BUCKET=<same exact staging bucket name>
YANDEX_STORAGE_ACCESS_KEY_ID=<same exact staging static-key id>
YANDEX_STORAGE_SECRET_ACCESS_KEY=...
```

The command refuses to run unless:

- `IB_STORAGE_TARGET` is exactly `staging`;
- the configured application bucket exactly matches `IB_STAGING_STORAGE_BUCKET`;
- the runtime Object Storage access-key ID exactly matches `IB_STAGING_STORAGE_ACCESS_KEY_ID`.

The key-ID pin prevents a staging verification from silently proceeding with a different service-account/static-key identity even when that identity also happens to have access to the staging bucket. The secret itself is never printed or committed; it is validated by Yandex when signed metadata requests are made.

## Read-only checks

The verifier performs:

1. target/bucket/access-key identity preflight before bucket metadata is accepted;
2. `HeadBucket` — bucket exists and the pinned service-account key can reach it;
3. `GetBucketAcl` — rejects grants to the S3 public groups `AllUsers` and `AuthenticatedUsers`;
4. `GetBucketPolicy` — absence of a policy is accepted. A deny-only policy is accepted. **Any `Allow` statement fails closed as `STAGING_STORAGE_POLICY_REVIEW_REQUIRED`** because principal, resource and condition semantics require explicit human review before the bucket can be called private. Policy JSON and principal identities are never printed;
5. `GetBucketCors` — requires the exact staging origin, rejects wildcard or additional origins, and requires browser `PUT` with `Content-Type` for the existing direct signed-upload flow.

`AllowedHeaders: *` is not treated as public access: CORS request-header matching does not grant object authorization. Wildcards are prohibited specifically in `AllowedOrigins`, where they would permit browser requests from unintended web origins.

The verifier never prints ACL grantee identities, policy JSON, access keys, object keys, signed URLs, cookies, file names, or object payloads.

## Why GET is not required by the CORS gate

The application returns short-lived signed download URLs that may be navigated to directly by the browser. CORS is mandatory for the cross-origin browser `PUT` upload flow because JavaScript uploads the object with `Content-Type`. If download implementation later changes to JavaScript `fetch`, extend the CORS gate to require `GET` before enabling that transport.

## Failure handling

A failure is a configuration/security signal, not permission to mutate the bucket. Review the staging bucket in Yandex Cloud and make any ACL/policy/CORS change separately with explicit infrastructure intent.

Do not work around an access-key identity mismatch by copying an arbitrary runtime key ID into `IB_STAGING_STORAGE_ACCESS_KEY_ID`. Confirm the intended staging service account/static key first.

Production bucket or production credential changes remain prohibited without explicit production approval.

A green repository CI run proves only that this verifier compiles and the application still builds. The remote staging bucket is not considered verified until this command is executed with staging credentials.

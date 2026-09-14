# iБюро — Private Object Storage Decision

Status: APPROVED ARCHITECTURAL DIRECTION
Branch: `audit/production-readiness`

## Decision

Use **Yandex Object Storage** as the preferred private file/object storage for iБюро.

The legal-domain database stores only file metadata (`StoredFile`), while binary file contents live in a private Object Storage bucket.

## Why

- aligns with the existing Yandex Cloud/PostgreSQL infrastructure direction;
- S3-compatible API;
- supports restricted/private buckets;
- supports pre-signed upload/download URLs;
- allows server-side control over object keys, authorization and URL lifetime;
- avoids storing large binaries in PostgreSQL;
- keeps the application free to replace the provider later through the `PrivateObjectStorage` contract.

## Security model

```text
Authenticated user
      ↓
server actor resolution
      ↓
ClientCase access check
      ↓
StoredFile metadata authorization
      ↓
PrivateObjectStorage adapter
      ↓
short-lived pre-signed URL
      ↓
private Yandex Object Storage bucket
```

A browser must never receive permanent storage credentials.

## Rules

1. Bucket remains private.
2. Object keys are generated server-side and are not authorization mechanisms.
3. `StoredFile.clientCaseId` determines legal-domain ownership/access.
4. Upload/download URL generation occurs only after server-side case authorization.
5. Signed URL lifetime should normally be 1–10 minutes; repository contract caps it at 15 minutes.
6. MIME type, extension and file size are validated before metadata registration.
7. Server should calculate or verify SHA-256 where practical for integrity/audit.
8. Original file name is metadata only; never use it directly as the storage object key.
9. Deleting metadata and deleting the object require an explicit lifecycle policy; do not silently orphan sensitive files.
10. Never make a bucket/object public to simplify downloads.

## Preferred object key format

Example:

```text
cases/<clientCaseUuid>/<fileUuid>/<opaque-generated-name>
```

Do not put a client's name, passport number, phone, email or case description into the object key.

## Implementation path

1. Create a private Yandex Object Storage bucket for staging.
2. Create a dedicated service account with the minimum required bucket permissions.
3. Add an S3-compatible server adapter behind `PrivateObjectStorage`.
4. Generate short-lived upload URLs after client-case authorization.
5. Confirm upload completion server-side and register `StoredFile` metadata.
6. Generate short-lived download URLs only after file/case authorization.
7. Add deletion/retention policy and audit events.
8. Repeat in production only after staging security/E2E checks pass.

## External configuration required later

Recommended environment configuration (exact credential method depends on final Yandex IAM/service-account setup):

- storage endpoint/region;
- private bucket name;
- service-account or S3 credential material available only to the server runtime;
- signed URL TTL policy.

No production storage bucket or credentials are created by this repository change.

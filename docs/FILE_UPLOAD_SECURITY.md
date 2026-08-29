# File upload security and malware quarantine

## Security objective

A successfully uploaded object is **not** a trusted document. Object Storage metadata such as size and `Content-Type` only proves that the expected object exists with matching transport metadata; it does not establish that PDF, DOC, DOCX or image content is safe.

The production file lifecycle is therefore fail-closed:

```text
PENDING_UPLOAD
  -> PENDING_SCAN
  -> SCANNING
  -> READY | QUARANTINED | SCAN_FAILED
```

`READY` is the only status visible through normal file list/get/download authorization. `PENDING_SCAN`, `SCANNING`, `QUARANTINED` and `SCAN_FAILED` files cannot receive a user-facing signed download URL.

## Upload completion boundary

Client upload completion performs only these operations:

1. resolve the authenticated internal actor and case authorization;
2. load the actor's `PENDING_UPLOAD` record;
3. verify the expected Object Storage provider;
4. perform Object Storage `HEAD` metadata verification;
5. delete the object and reject the completion if size or available MIME metadata mismatches;
6. atomically transition `PENDING_UPLOAD -> PENDING_SCAN` and create the controlled `file.upload.completed` audit event.

Upload completion never sets `READY`.

## Scan queue and leases

The scanner worker uses database-backed optimistic leases.

Eligible work is either:

- due `PENDING_SCAN`; or
- `SCANNING` whose lease has expired.

Claiming work generates a server-side UUID lease token, changes the status to `SCANNING`, sets `scanLeaseUntil`, and increments `scanAttemptCount`.

Every terminal or retry transition requires the same current lease token. A stale worker that lost its lease cannot make a file `READY`, quarantine it or overwrite the current retry state.

Scanner outcomes are handled as follows:

- `CLEAN` -> `READY`;
- `MALICIOUS` -> `QUARANTINED`;
- transient scanner/network/provider failure -> `PENDING_SCAN` with bounded exponential backoff;
- configured maximum attempts reached -> `SCAN_FAILED`;
- storage-provider mismatch -> `SCAN_FAILED` without invoking the scanner;
- lost lease -> no state change by the stale worker.

`SCAN_FAILED` and lease-loss results make the maintenance endpoint unhealthy so external scheduler/operations alerting can surface them.

## Scanner service trust boundary

The application uses a provider-neutral controlled HTTPS scanner service contract:

```http
POST /v1/scan-url
Authorization: Bearer <independent scanner secret>
Content-Type: application/json
```

Request body:

```json
{
  "sourceUrl": "<short-lived signed Yandex Object Storage URL>",
  "mimeType": "application/pdf",
  "sizeBytes": "12345"
}
```

The application does **not** send file name, `clientCaseId`, user ID, questionnaire data, document content in JSON, database identifiers or application auth credentials to the scanner service.

The source URL must be HTTPS, target Yandex Object Storage and contain a signed `X-Amz-Signature` query parameter. The scanner client refuses redirects.

The response must be bounded and exactly one of:

```json
{"verdict":"CLEAN"}
```

or:

```json
{"verdict":"MALICIOUS"}
```

Any unknown response shape, network detail, provider error body or unexpected exception is normalized to a controlled scanner error code. Raw provider/network exception text is never persisted as `scanLastErrorCode`.

## Signed URL security

Scanner source URLs are generated server-side only. They are not returned by the maintenance endpoint and are not stored in case activity metadata.

The scanner source URL TTL must be at least the scan lease duration, and the scanner request timeout must be shorter than the lease. The current conservative defaults are:

- scanner request timeout: 60 seconds;
- scan lease: 120 seconds;
- scanner source URL TTL: 180 seconds;
- scan batch: 1 file per maintenance invocation;
- maximum scan attempts: 5;
- retry backoff: 60 seconds up to 3600 seconds.

Batch size should only be increased after staging latency and scheduler-runtime measurements.

## Audit and privacy

Controlled case activity events are emitted for:

- `file.upload.registered`;
- `file.upload.completed` (`PENDING_SCAN`);
- `file.scan.clean`;
- `file.scan.quarantined`;
- `file.scan.failed`;
- `file.download.authorized`.

Activity metadata remains allowlisted. It may contain opaque file IDs, storage/scanner provider codes and lifecycle status, but never scanner secrets, source URLs, file content, filenames, user contact information or free-form scanner error details.

The maintenance API returns only aggregate counters:

- claimed;
- clean;
- quarantined;
- retried;
- failed;
- leaseLost.

It does not return file IDs, case IDs, user IDs, lease tokens or signed URLs.

## Staging scanner smoke gate

The repository contains an active staging-only verifier:

```bash
npm run check:staging:file-scanner
```

It is deliberately separate from CI. CI verifies the guard/client/verifier code; it does not call the remote staging scanner.

The smoke verifier:

- requires `IB_FILE_SCANNER_TARGET=staging` and `IB_STORAGE_TARGET=staging`;
- pins the exact staging scanner HTTPS origin;
- pins the scanner secret by SHA-256 fingerprint;
- pins the exact staging Object Storage bucket and access-key ID;
- accepts fixture object keys only below `security-fixtures/file-scanner/`;
- performs `HeadObject` plus local short-lived GET signing only;
- verifies one known-clean fixture returns exactly `CLEAN`;
- verifies one benign antivirus-detection fixture returns exactly `MALICIOUS`;
- never uploads, deletes or lists fixture objects;
- never prints fixture keys, signed URLs or secrets.

The fixture objects are created through a separate reviewed staging-infrastructure procedure. The application does not auto-create antivirus fixtures. Use a standard benign antivirus test artifact such as EICAR or the selected scanner vendor's equivalent; do not store real malware.

See `docs/STAGING_FILE_SCANNER_VERIFICATION.md` for the exact target guard and confirmation contract.

## Staging activation gates

Code-level quarantine is not equivalent to runtime activation. Before real client uploads are enabled in staging or production, all of the following must be completed:

- authoritative PostgreSQL baseline inspected first;
- reviewed Prisma migration created from that authoritative baseline;
- migration SQL manually reviewed;
- migration applied to staging only;
- `npm run db:verify:staging` confirms all `StoredFileStatus` values and scan columns;
- private staging Object Storage policy and exact staging access-key identity verified with `npm run check:staging:storage`;
- controlled HTTPS scanner service selected/deployed;
- independent scanner secret provisioned through the deployment secret store;
- dedicated benign scanner fixtures prepared under `security-fixtures/file-scanner/`;
- `npm run check:staging:file-scanner` passes both `CLEAN` and `MALICIOUS` fixture verdicts;
- file-scan maintenance scheduler configured against staging;
- scanner outage verifies retry/backoff and no READY transition;
- expired lease/reclaim behavior is exercised;
- maximum-attempt `SCAN_FAILED` alerting is observed;
- maximum allowed upload size (50 MiB) latency is measured and scanner/scheduler timeouts reviewed;
- quarantine retention/deletion and incident-response ownership are approved.

Until those external gates are complete, file-scanning runtime enablement remains `BLOCKED_EXTERNAL`.

## Prohibited shortcuts

Do not replace malware scanning with any of the following:

- extension checks;
- browser-supplied MIME type alone;
- Object Storage `Content-Type` alone;
- filename heuristics;
- client-side antivirus assertions;
- automatic `READY` on scanner timeout or scanner outage;
- manual database status edits to bypass quarantine;
- public or long-lived object URLs for scanner access.

# iБюро — Staging malware-scanner verification

## Purpose

`npm run check:staging:file-scanner` is an **active staging-only smoke test** for the file quarantine boundary.

It proves all of the following before a staging release can be called scanner-ready:

1. the configured scanner target is explicitly marked `staging`;
2. the configured scanner HTTPS origin exactly matches the expected staging origin;
3. the runtime scanner secret matches a pre-recorded SHA-256 fingerprint;
4. Object Storage is explicitly marked `staging`;
5. the configured bucket exactly matches the expected staging bucket;
6. the runtime Object Storage access-key ID exactly matches the expected staging key ID;
7. only dedicated objects below `security-fixtures/file-scanner/` can be used;
8. the clean fixture returns exactly `CLEAN`;
9. the benign antivirus-detection fixture returns exactly `MALICIOUS`.

This is separate from repository CI. CI verifies the guard and verifier code, but it does not call the remote scanner or staging bucket.

## No mutation guarantee

The verifier itself performs only:

- `HeadObject` for each fixture;
- local generation of a short-lived signed `GetObject` URL;
- one scanner request per fixture.

It does **not** perform:

- `PutObject`;
- `DeleteObject`;
- object listing;
- database access;
- client/case lookup;
- production traffic changes.

The scanner service fetches the two signed fixture URLs in order to inspect their contents. The application-side verifier never downloads or prints the fixture contents.

## Fixture requirements

Create the fixtures through a separate, reviewed staging-infrastructure procedure. Do not let the verifier create them automatically.

Required object keys must both be under:

```text
security-fixtures/file-scanner/
```

Recommended examples:

```text
security-fixtures/file-scanner/clean.txt
security-fixtures/file-scanner/eicar.txt
```

The malicious-detection fixture must be a standard benign antivirus test artifact such as EICAR or the equivalent supported by the selected scanner vendor. Do not place real malware in the bucket.

Each fixture must be non-empty and at most 1 MiB. The two object keys must differ.

## Required environment

```env
IB_FILE_SCANNER_TARGET="staging"
IB_FILE_SCANNER_ORIGIN="https://scanner-staging.example.com"
IB_STAGING_FILE_SCANNER_ORIGIN="https://scanner-staging.example.com"
IB_FILE_SCANNER_SECRET="<staging-scanner-secret>"
IB_STAGING_FILE_SCANNER_SECRET_SHA256="<sha256-of-exact-staging-scanner-secret>"

IB_STORAGE_TARGET="staging"
YANDEX_STORAGE_BUCKET="private-iburo-staging-files"
IB_STAGING_STORAGE_BUCKET="private-iburo-staging-files"
YANDEX_STORAGE_ACCESS_KEY_ID="<staging-storage-key-id>"
IB_STAGING_STORAGE_ACCESS_KEY_ID="<same-staging-storage-key-id>"
YANDEX_STORAGE_SECRET_ACCESS_KEY="<staging-storage-key-secret>"

IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY="security-fixtures/file-scanner/clean.txt"
IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY="security-fixtures/file-scanner/eicar.txt"
IB_STAGING_FILE_SCANNER_CONFIRM=""
```

Generate the scanner-secret fingerprint outside the repository. The raw scanner secret must never be committed.

The single-run confirmation format is:

```text
FILE-SCANNER-SMOKE:<scanner-hostname>:<staging-bucket>:<scanner-secret-sha256>
```

Example shape only:

```text
FILE-SCANNER-SMOKE:scanner-staging.example.com:private-iburo-staging-files:<64-lowercase-hex>
```

Set `IB_STAGING_FILE_SCANNER_CONFIRM` only for the intended verification run and clear it afterward.

## Command

After the staging Object Storage metadata policy has already passed:

```bash
npm run check:staging:storage
npm run check:staging:file-scanner
```

Expected terminal marker:

```text
STAGING_FILE_SCANNER_VERIFY_PASS
```

The command logs only aggregate success information. It does not print fixture object keys, signed URLs, scanner secrets or storage credentials.

## Failure semantics

Any of the following is a hard failure:

- scanner/storage target is not exactly `staging`;
- scanner origin mismatch;
- scanner-secret fingerprint mismatch;
- storage bucket mismatch;
- storage access-key ID mismatch;
- invalid/non-dedicated fixture key;
- fixture objects are missing, empty or oversized;
- scanner is unreachable or times out;
- scanner returns an invalid response;
- clean fixture does not return `CLEAN`;
- detection fixture does not return `MALICIOUS`.

Do not bypass a failed smoke test by manually marking files `READY` or by removing `check:staging:file-scanner` from the release chain.

## Production boundary

This command is intentionally staging-only. It is not a production scanner test and is not permission to connect staging tooling to production credentials, production buckets or production scanner endpoints.

Production enablement still requires an independently reviewed production scanner deployment, secret provisioning, scheduler/alerting, quarantine retention policy, incident-response ownership and a production release approval.

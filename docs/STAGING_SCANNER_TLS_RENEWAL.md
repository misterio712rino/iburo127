# iБюро — staging-v2 TLS verification and renewal boundary

Status: updated 2026-09-27. Scope is limited to `scanner-v2-staging.iburo127.online` on the staging-v2 scanner VM. This document does not authorize production changes, customer-file processing, worker/scheduler activation, IAM changes, or replacement of existing infrastructure.

## Current verified state

- Yandex Certificate Manager certificate `fpqg6c69vqs7khjkhcmt` is ISSUED for `scanner-v2-staging.iburo127.online`.
- Installed certificate currently expires **2026-12-21 08:34:45 UTC**.
- Installed chain/key pair on staging-v2 was independently validated for exact hostname, matching public key and safe permissions `root:caddy` with modes `0644/0640`.
- External unauthenticated `GET /health` returns `401` with successful TLS verification.
- Authorized scanner health and live synthetic CLEAN/MALICIOUS smoke have passed on staging; fixture cleanup was verified.
- The 43 real `PENDING_SCAN` records remain outside this TLS scope and must not be processed by a renewal test.

## Read-only TLS check

Run:

```bash
node scripts/check-staging-scanner-tls.mjs
node --test tests/staging-scanner-tls-check.test.mjs tests/staging-scanner-cert-pair.test.mjs
```

The live checker is pinned to the staging-v2 hostname and requires CA trust, exact hostname and more than 30 days remaining. It never authenticates to the scanner and never reads a private key.

The candidate-pair validator is for newly downloaded temporary files only. It requires the exact hostname, more than 30 days remaining, a strictly newer expiry than the installed certificate, certificate/private-key public-key match and safe private-key permissions. It does not install files or reload Caddy.

## Automatic renewal synchronization — not enabled

Yandex Certificate Manager can renew the managed certificate, but exported PEM files on the VM are not automatically synchronized. The current installed copy therefore requires an explicit renewal mechanism before the 30-day threshold.

Preferred design, subject to a separate IAM and scheduling approval:

1. Use a certificate-scoped downloader permission for the staging-v2 host identity only; do not grant folder-wide editor/admin.
2. Keep credentials on the host identity. Do not expose them to the scanner container, repository, GitHub logs or user profile.
3. Download a candidate pair into a root-owned `0700` temporary directory with the private key mode `0600`.
4. Validate exact hostname, remaining lifetime, strictly newer expiry and cert/key match before installation.
5. Atomically replace only the staging TLS files, preserving `root:caddy` ownership and `0644/0640` modes.
6. Run `caddy validate`, reload Caddy, verify local and external CA-validated HTTPS, and roll back to the immediately previous pair on any failure.
7. Remove temporary secret material after success or rollback.
8. Only after an owner, cadence and alert route are approved should a systemd timer or external scheduled job be enabled.

Until that design is explicitly approved and activated, run the read-only TLS checker manually and treat a result at or below 30 days remaining as a release blocker.

## Current release boundary

Scanner health, exact private Blob delegation, CLEAN/MALICIOUS verdicts and fixture cleanup are verified. TLS synchronization remains a separate operational gate. Production worker/scheduler activation, processing the existing 43 real pending files, production deployment and production IAM remain separate approval boundaries.

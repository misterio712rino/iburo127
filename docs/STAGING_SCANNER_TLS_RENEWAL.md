# iБюро: staging-v2 TLS verification and renewal boundary

Status captured 2026-09-22. This runbook covers **only** `scanner-v2-staging.iburo127.online` on `iburo-file-scanner-staging-v2`. It does not authorize production changes, customer-file processing, a scheduler, IAM changes, or replacement of existing infrastructure.

## Confirmed state

- Yandex Certificate Manager certificate `fpqg6c69vqs7khjkhcmt` is ISSUED for this hostname; expiration **2026-12-21 08:34:45 UTC**.
- The certificate and private key were manually installed for Caddy on staging-v2. The key is `root:caddy` mode `0640`. The previous Caddy configuration has a backup.
- Independent public HTTPS `/health` returns `401` without authorization and verifies the certificate; HTTP redirects with `308`. Scanner image `sha256:326d0645c82f14320d4dd673d75121ef6115263d98a08dcda7acdb71d82e4c8f` was observed running with zero restarts.
- A prior CI isolated ClamAV CLEAN/EICAR smoke is **not** the live HTTPS smoke against this deployment. Authenticated live health, CLEAN/MALICIOUS verdicts, staging app connectivity and renewal synchronization remain separate gates.

## Read-only certificate check

From a checkout with Node.js, run:

```bash
node scripts/check-staging-scanner-tls.mjs
node --test tests/staging-scanner-tls-check.test.mjs
```

The checker is pinned to the dedicated staging-v2 hostname and establishes a verified TLS connection. It inspects peer certificate metadata without requesting files, signing into services, or reading private keys. PASS requires a trusted certificate, matching hostname, and **more than 30 days** remaining. It does not claim authenticated scanner health or a malware-scan verdict.

An expired, invalid, unreachable, unexpected, or within-30-days certificate produces a nonzero result. Never disable certificate verification or change the hostname to make this pass. **No scheduled execution is enabled by this change.**

## Renewal synchronization: NOT CONFIGURED

Certificate Manager can renew its managed certificate, but an exported PEM/key on a VM does **not** automatically follow renewals. The installed copy must be refreshed before expiration. The earlier single-use installer must **not** be rerun: its backup and destination already exist by design.

The source now also contains an offline candidate-pair validator, `scripts/validate-staging-scanner-cert-pair.mjs`. It is intended only for newly downloaded files in a temporary root-owned staging directory. It verifies the exact staging hostname, more than 30 days of remaining lifetime, a strictly newer expiry than the installed certificate, certificate/private-key public-key match, and private-key permissions. It does **not** install files, reload Caddy, obtain cloud credentials, or read the currently installed private key.

Preferred future design, subject to a separate IAM, secret-handling and scheduling review:

1. Grant `certificate-manager.certificates.downloader` **on this certificate only**, not the whole production DNS zone or folder, to an approved VM identity. Inspect existing role bindings first; never grant broad editor/admin rights to make the download work.
2. Fetch certificate content from Yandex Cloud using a host-only workload identity, not a long-lived key in a repository, CI log or user profile. Container workloads must not gain access to the host's cloud metadata credentials.
3. Stage the chain and private key in a root-owned `0700` directory; use `0600` for staged secrets. Confirm issued status, exact hostname, certificate validity, the certificate/public-key match and a strictly newer expiration. Never emit PEM bodies or signed URLs.
4. Atomically update only the staging certificate files (`chain` publicly readable, private key `root:caddy` mode `0640`), validate Caddy, reload rather than restart, and check CA-verified local and external HTTPS. Retain the immediately previous pair for rollback.
5. If a check fails, restore the previous valid pair and configuration and report a non-secret failure marker. Remove temporary secret copies; verify no changes to the scanner container, original VM or customer queue.
6. Only after an approved owner, cadence and notification route exist may a systemd timer or an external scheduled job be added. Include renewal-failure/expiry alerts and a rollback drill. Until then, run the read-only check manually and track the expiry.

Official permissions model: [Yandex Certificate Manager access control](https://yandex.cloud/ru/docs/certificate-manager/security/) and [certificate export](https://yandex.cloud/en/docs/certificate-manager/operations/import/cert-get-content). The latter requires `certificate-manager.certificates.downloader` for certificate contents.

## Remaining staging smoke gates (as of 2026-09-22)

The existing `.github/workflows/staging-file-scanner-smoke.yml` requires two GitHub Actions repository secret **names** that were absent in the latest name-only inventory: `IB_STAGING_FILE_SCANNER_SECRET` and `IB_STAGING_BLOB_READ_WRITE_TOKEN`. `VERCEL_AUTOMATION_BYPASS_SECRET` exists. Do not infer presence of a secret from a VM Lockbox value or an environment variable in a different service. Do not substitute production secrets, bypass the SHA-256 fingerprint confirmation or print credential values.

The live workflow is scoped to `audit/production-readiness`, the exact candidate SHA, the dedicated staging scanner HTTPS origin, an exact private staging Blob hostname and two SHA-scoped synthetic fixture keys. Before running it, confirm dedicated staging credentials and the correct Vercel Blob instance from trusted metadata. It uploads only a synthetic CLEAN fixture and inert EICAR test string, verifies CLEAN and MALICIOUS, and removes the fixtures in `finally`. A passing repository CI or a public unauthenticated `401` is not a passing live smoke.

Do not merge draft PRs, enable the production worker or scheduler, inspect or process the 43 genuine pending customer documents, alter production DNS/database or delete the original scanner VM/disk/snapshot as part of this TLS task. Keep issue #8 open until authenticated live scanner smoke, fixture cleanup and renewal operations are independently validated.

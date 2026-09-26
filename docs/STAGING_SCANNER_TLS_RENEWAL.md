# iБюро — staging-v2 TLS verification and renewal boundary

Status: updated 2026-09-27. Scope is limited to `scanner-v2-staging.iburo127.online` on the staging-v2 scanner VM. This document does not authorize production changes, customer-file processing, application worker/scheduler activation, production IAM changes, or replacement of existing infrastructure.

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

The candidate-pair validator is for newly downloaded temporary files only. It requires the exact hostname, more than 30 days remaining, a strictly newer expiry than the installed certificate, certificate/private-key public-key match and safe private-key permissions.

## Automatic renewal synchronization — ENABLED

The staging runtime service account `ajefk29ob0g7t5mlbc5i` has only the resource-scoped role `certificate-manager.certificates.downloader` on certificate `fpqg6c69vqs7khjkhcmt`. No folder-wide editor/admin role was added.

Installed runtime components:

- `/usr/local/sbin/iburo-staging-tls-renew`
- `/etc/systemd/system/iburo-staging-tls-renew.service`
- `/etc/systemd/system/iburo-staging-tls-renew.timer`

Operational behavior:

1. Normal timer runs daily at 04:15 UTC with up to 45 minutes randomized delay and `Persistent=true`.
2. Until the installed certificate has 45 days or fewer remaining, the service exits with `STAGING_TLS_RENEW_NOT_DUE` and does not export certificate/private-key material.
3. Inside the renewal window, the host obtains a short-lived IAM token from the VM metadata service and requests only the configured certificate through Certificate Manager `getContent`.
4. The IAM token is passed to curl through a root-only temporary header file, not a process argument.
5. Candidate chain/key material exists only in a root-owned `0700` directory under `/run`; files use `0600`.
6. Candidate validation requires exact hostname, >30 days remaining, valid start time, cert/key public-key match and a strictly newer expiry than the installed certificate.
7. If the Certificate Manager copy is identical to the installed pair, the service returns `STAGING_TLS_RENEW_NOOP` and does not rewrite the installed files.
8. A new pair is installed with `root:caddy` ownership and `0644/0640` modes. Caddy config validation, reload and local CA-verified HTTPS `401` are mandatory; failure restores the immediately previous pair.
9. Temporary token/certificate/key material is removed on exit.
10. The scanner container remains blocked from the VM metadata endpoint by the `DOCKER-USER` REJECT rule; the downloader permission is therefore host-only.

Deployment evidence from 2026-09-27:

- PR #51 exact head `97aa3d01e0f3eec72dc60d4c844d537459f4ae06`: CI and Secret History PASS before rollout.
- `systemd-analyze verify` passed for the service and timer.
- Manual host forced-check after granting the scoped role: `STAGING_TLS_RENEW_NOOP current_certificate=true remaining_days=85`.
- Forced-check **inside the hardened systemd service**: `Result=success`, `ExecMainStatus=0`, same NOOP marker.
- Normal systemd execution: `STAGING_TLS_RENEW_NOT_DUE remaining_days=85`.
- Timer verified `enabled` and `active`.
- Temporary force environment was removed from the systemd manager.
- Container metadata firewall rule rechecked PASS after the IAM grant.
- External HTTPS after activation: HTTP 401, TLS verification result 0, remote IP `158.160.167.220`.
- Temporary SSH ingress used for rollout was removed after verification.

No external paging/notification channel is configured specifically for this timer. Failures are recorded as failed systemd service executions and in the system journal. Proactive external alerting remains a monitoring-hardening item; it does not change the certificate download/install path above.

## Current release boundary

Scanner health, exact private Blob delegation, CLEAN/MALICIOUS verdicts, fixture cleanup and automatic staging TLS synchronization are verified. Remaining independent boundaries include aggregate maintenance backlog health, production worker/scheduler activation, processing the existing 43 real pending files, production deployment and production IAM.

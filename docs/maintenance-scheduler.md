# Maintenance scheduler runbook

## Scope

The repository provides a provider-neutral runner for bounded authenticated maintenance jobs. It intentionally does **not** select or provision the production scheduler provider; Vercel Cron, Yandex Cloud scheduling, Kubernetes CronJob or another platform must be selected and verified separately before production readiness can be claimed.

Supported jobs:

- `notification-deliveries`
- `notification-delivery-health`
- `task-reminders`
- `questionnaire-reminders`
- `stale-uploads`
- `stale-upload-health`
- `file-scans`
- `file-scan-health`
- `file-deletions`
- `file-deletion-health`
- `ai-audit-health`

The runner is `node scripts/run-maintenance-job.mjs <job>`; package scripts wrap the established jobs. `file-deletion-health` may be invoked through the generic runner until a dedicated package alias is added.

## Security boundary

The runner requires:

```env
IB_MAINTENANCE_BASE_URL="https://staging-app.example.com"
IB_MAINTENANCE_SECRET="<independent-random-secret-32+-chars>"
IB_MAINTENANCE_REQUEST_TIMEOUT_MS="15000"
```

For non-loopback requests it validates runtime target identity before using the maintenance secret. Staging requires the maintenance origin to match both `BETTER_AUTH_URL` and `IB_STAGING_BASE_URL`. Production additionally requires the exact one-run confirmation `IB_MAINTENANCE_PRODUCTION_CONFIRM=PRODUCTION:<origin>`. Redirects are refused, Bearer secrets are never put into command arguments, and a non-JSON/non-2xx/`ok !== true` response exits non-zero.

All jobs must have independent schedules/failure alerting where the scheduler platform permits it. Do not combine unrelated workers into one failure domain.

## Worker / health pairs

These pairs must be scheduled independently so a stopped worker schedule can still be detected:

- `notification-deliveries` + `notification-delivery-health`
- `stale-uploads` + `stale-upload-health`
- `file-scans` + `file-scan-health`
- `file-deletions` + `file-deletion-health`

### File deletion activation boundary

`file-deletions` and `file-deletion-health` depend on the additive `StoredFileDeletion` table. **Do not schedule either job before the staging migration exists and is verified.** `IB_FILE_DELETION_MODE` must remain `legacy` until migration verification and scheduler provisioning are complete.

Initial worker behavior is deliberately conservative: one deletion claim per invocation. The independent health check defaults to:

```env
IB_FILE_DELETION_HEALTH_GRACE_MINUTES="15"
IB_FILE_DELETION_HEALTH_BATCH_LIMIT="50"
```

Health is unhealthy when:

- a `PENDING` deletion remains due beyond the grace window;
- a `PROCESSING` lease remains expired beyond the grace window;
- any deletion is in terminal `REQUIRES_ATTENTION`;
- any bounded category exceeds the inspection limit (`saturated=true`).

The health response contains aggregate counters/configuration only; it never returns file IDs, case/user IDs, object keys or lease tokens.

## Existing maintenance guidance

Notification delivery and its health check, stale-upload cleanup and its health check, and malware scanning and its health check keep their existing bounded lease/retry semantics. File scanning starts with batch size 1 and must not be enlarged until staging latency and 50 MiB upload behavior are measured. `QUARANTINED` remains a valid malware-security outcome rather than scheduler failure.

Task/questionnaire reminder jobs and AI audit health are independent jobs and must not be suppressed by storage, scanner or email-provider incidents.

## Release status

Code-level invocation exists for the maintenance jobs above and is guarded by target/auth contracts. Provider-specific recurring scheduler infrastructure is **not configured or verified** in the repository. Production readiness therefore remains externally blocked until the chosen scheduler is provisioned, observed against staging, and wired to failure alerting.

For durable file deletion specifically, follow `docs/STAGING_FILE_DELETION_ACTIVATION.md`; never activate the mode merely because the code builds.

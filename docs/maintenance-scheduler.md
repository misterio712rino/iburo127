# Maintenance scheduler runbook

## Scope

The repository provides a provider-neutral runner for bounded authenticated maintenance jobs and now includes a repository-tracked GitHub Actions schedule for the durable file-deletion worker/health pair.

Supported runner jobs:

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

The runner is `node scripts/run-maintenance-job.mjs <job>`; package scripts wrap the established jobs. `file-deletion-health` may be invoked directly through the generic runner until a dedicated package alias is added.

## Security boundary

The runner requires scheduler-supplied environment values rather than hard-coded origins or credentials:

```env
IB_RUNTIME_TARGET="staging|production"
IB_MAINTENANCE_BASE_URL="https://app.example.com"
BETTER_AUTH_URL="https://app.example.com"
IB_MAINTENANCE_SECRET="<independent-random-secret-32+-chars>"
IB_MAINTENANCE_REQUEST_TIMEOUT_MS="15000"
```

For non-loopback requests it validates runtime target identity before using the maintenance secret. Staging additionally requires the maintenance origin to match `IB_STAGING_BASE_URL`. Production additionally requires the exact confirmation `IB_MAINTENANCE_PRODUCTION_CONFIRM=PRODUCTION:<origin>`. Redirects are refused, Bearer secrets are never placed in command arguments, and non-JSON, non-2xx or `ok !== true` responses exit non-zero.

## Durable file-deletion scheduler

`.github/workflows/file-deletion-maintenance-scheduler.yml` is the selected repository-tracked schedule for the durable deletion pair.

It runs on a five-minute cron **only after** all of these conditions are true:

1. the workflow exists on the repository default branch;
2. repository variable `IB_FILE_DELETION_SCHEDULER_ENABLED` is exactly `true`;
3. the job is executing from the default branch;
4. scheduler target/origin variables satisfy the generic maintenance runner guards;
5. a valid independent `IB_MAINTENANCE_SECRET` is available;
6. production targets additionally satisfy the explicit production confirmation guard.

The audit branch therefore contains scheduler wiring without activating production. Do not set the enable flag or production values merely because this workflow exists.

The workflow deliberately uses **two independent jobs**:

- `file-deletions` invokes one bounded deletion-worker batch;
- `file-deletion-health` independently checks backlog health.

There is no `needs` dependency between them. A worker failure must not suppress backlog-health execution.

## Worker / health pairs

Worker and health checks should remain independent failure domains where the scheduler platform permits it:

- `notification-deliveries` + `notification-delivery-health`
- `stale-uploads` + `stale-upload-health`
- `file-scans` + `file-scan-health`
- `file-deletions` + `file-deletion-health`

Only the durable file-deletion pair currently has repository-tracked recurring GitHub Actions wiring. Other maintenance pairs still require a separately reviewed recurring schedule before full production enablement is claimed.

### File deletion activation boundary

`file-deletions` and `file-deletion-health` depend on the additive `StoredFileDeletion` table and the durable deletion mode.

The audit/staging path has already exercised durable deletion through exact-Preview staging E2E. That does **not** authorize production activation. Production must keep its current mode/configuration unchanged until its migration, environment values, scheduler enable flag and operational alerting are separately reviewed and explicitly approved.

Initial worker behavior remains deliberately conservative: one deletion claim per invocation. The independent health check defaults to:

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

Durable file deletion now has:

- guarded request-side enqueue semantics;
- durable tombstone/retry/lease processing;
- aggregate backlog health;
- exact-Preview staging runtime E2E evidence;
- a fail-closed repository-tracked five-minute GitHub Actions schedule with independent worker/health jobs.

Production scheduling is **not active or claimed**. Production readiness still requires explicit production migration/configuration approval, scheduler variables/secret provisioning, enable-flag activation, and observed production-safe alerting. Other maintenance workers also retain their own scheduling/provisioning requirements.

For staging activation/rollback details follow `docs/STAGING_FILE_DELETION_ACTIVATION.md`.

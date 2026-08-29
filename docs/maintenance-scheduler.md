# Maintenance scheduler runbook

## Scope

The application exposes four bounded, authenticated maintenance operations:

- `POST /api/internal/maintenance/notification-deliveries` — processes a bounded notification-delivery batch using leases, retry/backoff and dead-state handling;
- `POST /api/internal/maintenance/stale-uploads` — cleans a bounded batch of stale `PENDING_UPLOAD` objects;
- `POST /api/internal/maintenance/file-scans` — claims uploaded files from the malware-scan queue using leases and advances only scanner-confirmed clean files to `READY`;
- `POST /api/internal/maintenance/ai-audit-health` — performs a bounded read-only check for accepted AI requests that are missing a correlated terminal outcome after the configured grace period.

The repository intentionally does **not** configure a production scheduler provider. Deployment infrastructure has not been authoritatively selected/verified for this production-readiness stage, so adding Vercel Cron, a cloud scheduler, Kubernetes CronJob, or another provider-specific resource would be premature.

## Provider-neutral runner

External scheduler infrastructure can invoke the maintenance endpoints through the repository runner:

```bash
npm run maintenance:run:notifications
npm run maintenance:run:stale-uploads
npm run maintenance:run:file-scans
npm run maintenance:run:ai-audit-health
```

The runner requires:

```env
IB_MAINTENANCE_BASE_URL="https://app.example.com"
IB_MAINTENANCE_SECRET="<independent-random-secret-32+-chars>"
IB_MAINTENANCE_REQUEST_TIMEOUT_MS="15000"
IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS="120000"
```

`IB_MAINTENANCE_BASE_URL` must be an HTTPS origin with no path, query, fragment or embedded credentials. Plain HTTP is accepted only for loopback/local verification.

The runner:

- sends `POST` only to one of the four fixed maintenance paths;
- sends the maintenance secret only in the `Authorization: Bearer ...` header;
- does not include the secret in success/failure output;
- refuses redirects;
- requires a JSON response with HTTP success and `ok: true`;
- exits non-zero for transport failures, timeouts, non-JSON responses, HTTP failures or unhealthy maintenance results.

A non-zero runner exit must be treated by the external scheduler as a failed execution and surfaced to operations/alerting. Do not hide or automatically convert failures into success.

## Scheduling guidance

### Notification delivery

The notification endpoint processes a bounded batch of 10 deliveries per invocation. An initial cadence should be selected from expected notification volume and observed outbox backlog rather than hard-coded into application logic. Retry/dead counts should determine whether cadence or worker capacity needs adjustment.

### Stale uploads

Stale-upload cleanup is lower frequency. Its default stale threshold is 60 minutes and its default batch limit is 100. The external schedule should run often enough that abandoned `PENDING_UPLOAD` objects do not materially accumulate beyond that threshold.

### File malware scans

File scanning is intentionally conservative at first: default batch size is **1** file per invocation. Each claimed file has a DB lease, and scanner/source-URL timeouts are configured independently from the outer scheduler request timeout.

Relevant application settings:

```env
IB_FILE_SCAN_BATCH_LIMIT="1"
IB_FILE_SCAN_LEASE_SECONDS="120"
IB_FILE_SCAN_SOURCE_URL_TTL_SECONDS="180"
IB_FILE_SCAN_MAX_ATTEMPTS="5"
IB_FILE_SCAN_RETRY_BASE_SECONDS="60"
IB_FILE_SCAN_RETRY_MAX_SECONDS="3600"
```

The scanner itself is a separate controlled HTTPS service configured with:

```env
IB_FILE_SCANNER_ORIGIN="https://scanner.internal.example.com"
IB_FILE_SCANNER_SECRET="<independent-random-secret-32+-chars>"
IB_FILE_SCANNER_REQUEST_TIMEOUT_MS="60000"
```

The scan endpoint returns HTTP 503 when terminal scan failures or lease-loss anomalies occur. The external scheduler must surface that as an operational failure.

Do not increase scan batch size until staging measurements establish acceptable scanner latency, application request duration and behavior for the 50 MiB maximum upload size.

### AI audit health

The AI audit health job is read-only. It checks for accepted AI requests whose opaque correlation ID has no terminal completion/restricted/failure outcome after the configured grace period. A nonzero orphan count returns 503 so scheduler alerting can surface the anomaly.

## Job isolation

All four jobs must be scheduled independently. An Object Storage/scanner incident must not suppress notification delivery; an email-provider incident must not suppress stale upload cleanup or AI audit health checks.

## Security requirements

- Use an independent maintenance secret; do not reuse Better Auth, database, storage, Postbox, scanner or OpenAI credentials.
- Use a separate independent scanner secret for the application-to-scanner service boundary.
- Keep secrets in the scheduler/deployment secret store, never in source control or scheduler command arguments that are exposed in process listings/logs.
- The scheduler target must be the exact intended application origin over HTTPS.
- The scanner origin must be a controlled HTTPS origin; the application refuses redirects.
- Do not enable unauthenticated GET-based cron access as a convenience workaround.
- Preserve bounded worker limits and lease/retry semantics unless a separate capacity review justifies changes.
- Scheduler logs must not contain request authorization headers or runtime secrets.
- Scanner responses and maintenance results must not expose signed source URLs, lease tokens or client/case/user identifiers.

## Release status

Code-level scheduler invocation exists for all four maintenance jobs and is covered by foundation tests.

Production scheduler infrastructure is **not configured or verified**. Production readiness remains `BLOCKED_EXTERNAL` until the actual deployment platform is confirmed and the required recurring jobs are provisioned, executed against staging, observed, and wired to failure alerting.

File-scan scheduling has additional external prerequisites: the authoritative database migration must be applied to staging, the controlled scanner service must be provisioned and its clean/quarantine/retry/lease-recovery behavior must be verified as described in `docs/FILE_UPLOAD_SECURITY.md`.

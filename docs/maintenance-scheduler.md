# Maintenance scheduler runbook

## Scope

The application already exposes two bounded, authenticated maintenance operations:

- `POST /api/internal/maintenance/notification-deliveries` — processes a bounded notification-delivery batch using leases, retry/backoff and dead-state handling;
- `POST /api/internal/maintenance/stale-uploads` — cleans a bounded batch of stale pending uploads.

The repository intentionally does **not** configure a production scheduler provider. Deployment infrastructure has not been authoritatively selected/verified for this production-readiness stage, so adding Vercel Cron, a cloud scheduler, Kubernetes CronJob, or another provider-specific resource would be premature.

## Provider-neutral runner

External scheduler infrastructure can invoke the maintenance endpoints through the repository runner:

```bash
npm run maintenance:run:notifications
npm run maintenance:run:stale-uploads
```

The runner requires:

```env
IB_MAINTENANCE_BASE_URL="https://app.example.com"
IB_MAINTENANCE_SECRET="<independent-random-secret-32+-chars>"
IB_MAINTENANCE_REQUEST_TIMEOUT_MS="15000"
```

`IB_MAINTENANCE_BASE_URL` must be an HTTPS origin with no path, query, fragment or embedded credentials. Plain HTTP is accepted only for loopback/local verification.

The runner:

- sends `POST` only to one of the two fixed maintenance paths;
- sends the maintenance secret only in the `Authorization: Bearer ...` header;
- does not include the secret in success/failure output;
- refuses redirects;
- requires a JSON response with HTTP success and `ok: true`;
- exits non-zero for transport failures, timeouts, non-JSON responses, HTTP failures or unhealthy maintenance results.

A non-zero runner exit must be treated by the external scheduler as a failed execution and surfaced to operations/alerting. Do not hide or automatically convert failures into success.

## Scheduling guidance

The notification endpoint processes a bounded batch of 10 deliveries per invocation. An initial scheduler cadence should therefore be selected from expected notification volume and observed outbox backlog rather than hard-coded into the application. For an active service, a short recurring interval is normally appropriate; backlog and retry/dead counts should determine whether the cadence or worker capacity needs adjustment.

Stale-upload cleanup is lower frequency. Its default stale threshold is 60 minutes and its default batch limit is 100. The external schedule should run often enough that stale pending uploads do not accumulate materially beyond the configured threshold, while remaining independent from user requests.

The two jobs should be scheduled independently so an object-storage incident does not suppress notification delivery, and an email-provider incident does not suppress stale-upload cleanup.

## Security requirements

- Use an independent maintenance secret; do not reuse Better Auth, database, storage, Postbox or OpenAI credentials.
- Keep the secret in the scheduler/deployment secret store, never in source control or scheduler command arguments that are exposed in process listings/logs.
- The scheduler target must be the exact intended application origin over HTTPS.
- Do not enable unauthenticated GET-based cron access as a convenience workaround.
- Preserve the existing bounded worker limits and retry semantics unless a separate capacity review justifies changes.
- Scheduler logs must not contain request authorization headers or runtime secrets.

## Release status

Code-level scheduler invocation is prepared and covered by foundation tests.

Production scheduler infrastructure is **not configured or verified**. Production-readiness for this item remains `BLOCKED_EXTERNAL` until the actual deployment platform is confirmed and both recurring jobs are provisioned, executed against staging, observed, and wired to failure alerting.

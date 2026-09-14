# Stale pending-upload cleanup

The upload lifecycle creates a `StoredFile(PENDING_UPLOAD)` before returning a short-lived signed upload URL. If a browser never completes the upload, stale metadata and possibly an object can remain.

## Concurrency safety

Cleanup must never delete an object that has already become `READY`.

The worker therefore uses this order:

1. list rows older than the configured threshold;
2. conditionally delete metadata only while the row is still `PENDING_UPLOAD`;
3. only after that claim succeeds, delete the private object;
4. if object deletion fails, restore the original `PENDING_UPLOAD` metadata so a later run can retry.

This replaces the unsafe storage-first ordering, where a concurrent `PENDING_UPLOAD -> READY` transition could occur immediately before object deletion.

The default stale threshold is 60 minutes. Signed upload URLs are currently issued for 5 minutes, so the cleanup threshold is intentionally much longer than the upload capability lifetime.

## Maintenance endpoint

`POST /api/internal/maintenance/stale-uploads`

Required header:

```text
Authorization: Bearer <IB_MAINTENANCE_SECRET>
```

`IB_MAINTENANCE_SECRET` must be an independent random secret at least 32 characters long. Do not reuse `BETTER_AUTH_SECRET`, storage keys, cookies or database credentials.

Optional configuration:

```text
IB_STALE_UPLOAD_MAX_AGE_MINUTES=60   # 15..10080
IB_STALE_UPLOAD_BATCH_LIMIT=100      # 1..500
```

The endpoint returns counts only (`inspected`, `deleted`, `skipped`, `failed`), sets `Cache-Control: no-store`, and never exposes object keys, signed URLs, file names, credentials or cookies.

A response with `failed > 0` returns HTTP 503 so the scheduler/monitoring layer can alert and retry. Failed storage deletions have their metadata restored before the response.

## Scheduling

The route is scheduler-agnostic. A staging scheduler can call it periodically once a private staging bucket and maintenance secret exist. Hourly execution is a reasonable default with the current 60-minute stale threshold.

Configuring an external scheduler is a deployment/infrastructure action and is intentionally not performed by this repository change. Production scheduling requires explicit production approval.

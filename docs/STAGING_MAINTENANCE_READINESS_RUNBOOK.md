# Staging maintenance readiness: evidence and safe remediation

This runbook is for the `audit/production-readiness` branch. It documents diagnosis; it **does not authorize** changing cloud resources, secrets, database records, object storage, schedulers, the malware scanner, PR #1, or production.

## Verified snapshot (2026-09-18, SHA `cf50faa42668c047f3bc3987468aefe0222a0716`)

Sources: [External Readiness #890](https://github.com/misterio712rino/iburo127/actions/runs/35321832737), [CI #3022](https://github.com/misterio712rino/iburo127/actions/runs/35321832864), [Application E2E #904](https://github.com/misterio712rino/iburo127/actions/runs/35321832852). Re-check the actual branch HEAD and exact-SHA runs before treating these numbers as current.

- Exact Preview identity, read-only staging DB baseline and provider inventory steps passed. Vercel deployment `dpl_HkyjFm5guuyZy5x4by5sTtYrXXtu` was READY for the exact branch/SHA. CI, Secret History, scan classifier and Application E2E passed.
- `staging-maintenance-health` returned HTTP 503; the downstream private-storage proof was **skipped**, not failed.
- Aggregate health: notification delivery healthy; stale uploads `overdue=1`; scans `overduePending=43`, no expired leases or terminal failures; file deletion `overduePending=1`, no expired leases or `REQUIRES_ATTENTION`; AI audit has zero orphans. A successful classifier does **not** mean 43 files were malware-scanned.
- Runtime inventory: storage 4/4, AI 9/9, Postbox 8/8; scanner 3/12 and inactive; maintenance 3/5, missing `IB_MAINTENANCE_SECRET` and `IB_MAINTENANCE_BASE_URL`. The durable deletion mode is configured but readiness is blocked.
- The health route is **read-only**; it returns counts and configuration booleans, and deliberately substitutes an in-process sentinel only for parsing numeric thresholds. It never invokes a maintenance worker.

## What the two single-record counters mean (not root-cause conclusions)

- `staleUploads.overdue=1`: one `StoredFile` metadata row has `status=PENDING_UPLOAD` and `createdAt <= now - (IB_STALE_UPLOAD_MAX_AGE_MINUTES + IB_STALE_UPLOAD_HEALTH_GRACE_MINUTES)`. Defaults are 60 + 30 minutes unless overridden. This alone does not establish whether its object exists, whether an upload failed, or whether deletion is safe.
- `fileDeletion.overduePending=1`: one `StoredFileDeletion` job has `status=PENDING` and `nextAttemptAt <= now - deletionHealth.graceMinutes`. There are no expired processing leases and no attention-required rows in this snapshot. This alone does not establish that a delete was attempted or that the storage provider failed.
- The cleanup service conditionally claims `PENDING_UPLOAD` metadata **before** deleting an object and restores metadata if object deletion fails; the durable deletion worker claims a job, calls idempotent object deletion and commits completion with audit. Both can modify real data and **must not** be run merely to make the health gate green.

## Why scheduling is not active

- The audit branch contains `.github/workflows/core-maintenance-scheduler.yml`, `.github/workflows/file-deletion-maintenance-scheduler.yml`, and `.github/workflows/file-scan-maintenance-scheduler.yml`; direct file reads on `main` returned 404 for each at this snapshot. GitHub `schedule` uses the default-branch workflow, so audit-only cron declarations do not establish a running scheduler.
- Core and deletion jobs also require their respective `IB_*_SCHEDULER_ENABLED` variable to equal `true` **and** the default-branch ref. The runner (`scripts/run-maintenance-job.mjs`) validates maintenance secret, HTTPS target, runtime target and matching auth/staging origins before issuing POST; it is not a read-only diagnostic.
- No scheduler activation, moving the workflow to `main`, enabling flags, setting a secret or invoking `workflow_dispatch` is implied by this runbook. Scanner activation is an independent approval boundary.

## Safe sequence for an authorized release operator

1. **Read-only only:** reconfirm actual HEAD, exact Preview deployment SHA, inventory, classifier and external readiness results. Check that the latest diagnostics still show the same counters. Do not reuse previous-SHA PASS as new-SHA evidence.
2. **Identify the actual staging DB:** verify its environment, host, database and role against the approved staging fingerprint before any inspection. The separately connected Neon project `iburo127-dev` is **not** proof of staging DB identity. Do not query a guessed database.
3. **Minimal read-only examination after identity/permission verification:** inspect only status, timestamps, retry/lease metadata, storage provider and technical-fixture classification for the single stale-upload and deletion records. Do not copy client IDs, object keys, document contents, URLs, tokens or personal data into issue reports or logs. Establish object state only through an approved narrowly scoped mechanism. If identity or access cannot be proven, mark `UNVERIFIED`.
4. Determine whether each counter reflects a missing scheduler, an expected still-pending operation, provider mismatch, failed attempt or a separate defect. Avoid blanket cleanup and do not change health thresholds to conceal backlog.
5. Request **separate explicit authorization** for staging-specific maintenance configuration and any worker/scheduler execution. Specify exact environment, target, expected records, safety guard, backup/audit evidence and rollback limits. Do not merge all workers or the scanner into one approval.
6. Malware scanner: publish immutable staging image and prove health plus CLEAN/MALICIOUS smoke through separately authorized infrastructure and activation; only then process the 43 genuine `PENDING_SCAN` records. Never delete, force-clear, reclassify or mark them READY manually.
7. Re-run exact-SHA external readiness. Require complete scanner/maintenance configuration, healthy queues, private-storage proof and separate mobile/production acceptance; a green CI or a READY Preview alone cannot authorize production.

**Stop conditions:** any unknown DB target, nontechnical/client record selected for fixture cleanup, provider mismatch, missing secret, unverified Preview SHA, unresolved scanner state, unexpected record-count change, or request to touch production. Preserve evidence and escalate instead of performing destructive recovery.

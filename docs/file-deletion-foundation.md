# Durable client-file deletion — pre-activation state

The durable deletion implementation is now wired behind an explicit runtime cutover guard, but it remains **inactive by default**.

## Current code state

- `IB_FILE_DELETION_MODE` is fail-closed: missing or `legacy` uses the existing synchronous delete path; only exact `durable` enables atomic tombstone enqueue.
- `StoredFileDeletion` persistence, owner-scoped idempotent request handling, lease/retry processing and atomic `file.deleted` finalization are implemented.
- `POST /api/internal/maintenance/file-deletions` exposes a bounded authenticated worker run.
- `POST /api/internal/maintenance/file-deletion-health` independently checks overdue pending deletions, expired processing leases, terminal `REQUIRES_ATTENTION` records and bounded-query saturation.
- Object deletion is required to be idempotent. A finalization failure never recreates the active file row after external deletion may have succeeded; lease recovery repeats the idempotent object delete and retries atomic finalization.

## Still blocked before staging activation

The additive `StoredFileDeletion` migration has **not** been applied to staging. Do not set `IB_FILE_DELETION_MODE=durable` and do not schedule either deletion job until that migration has been explicitly approved, applied to staging and verified.

Activation additionally requires:

1. exact migration SQL review and current read-only staging DB baseline;
2. authoritative staging backup/snapshot;
3. explicit approval for the staging DB mutation;
4. protected recurring schedules for both `file-deletions` and the independent `file-deletion-health` check;
5. staging owner/cross-owner HTTP E2E;
6. fault-injection verification for absent objects, transient storage failure/retry, lease recovery and finalization deferral;
7. evidence that the queue drains and `file.deleted` is finalized exactly once.

The activation/rollback sequence is documented in `docs/STAGING_FILE_DELETION_ACTIVATION.md`.

# Staging durable file deletion activation

This is a staging-only activation checklist. It does not authorize a production migration or deployment.

## Hard preconditions

Before any staging DB mutation:

1. exact audit-branch SHA is code-green;
2. PR #1 remains open, draft and unmerged;
3. take a current read-only DB baseline with `npm run db:inspect:baseline`;
4. create/verify an authoritative staging DB backup or snapshot using the selected infrastructure controls;
5. review `prisma/migrations/20260906_stored_file_deletion_foundation/migration.sql` with `IB_MIGRATION_SQL_PATH=... npm run db:review:sql` and manually review the UNIQUE indexes;
6. obtain explicit user approval for the staging DB mutation.

`prisma db push` is forbidden.

## Migration sequence

1. Keep `IB_FILE_DELETION_MODE=legacy`.
2. Apply the reviewed migration only through the guarded staging migration path.
3. Run staging schema/migration verification and DB-backed authz/E2E checks.
4. Verify `file-deletion-health` against the migrated empty/known queue while the interactive DELETE path is still legacy.
5. Provision independent recurring schedules and failure alerts for:
   - `file-deletions`
   - `file-deletion-health`
6. Confirm both scheduler targets resolve to the exact protected staging origin and use the independent maintenance secret.
7. Only then set `IB_FILE_DELETION_MODE=durable` on staging.

## Required runtime verification

Use dedicated mutable staging fixtures and verify:

- owner DELETE atomically removes the active file row and creates one pending tombstone;
- repeated owner DELETE is idempotent and does not create duplicate work;
- another CLIENT cannot discover or delete the tombstone/file;
- LAWYER/MANAGER cannot perform client deletion;
- worker deletes the object and atomically records `COMPLETED` plus exactly one canonical `file.deleted` activity;
- already-absent object is treated as successful idempotent storage deletion;
- transient storage error is rescheduled with bounded backoff;
- max-attempt/provider mismatch reaches `REQUIRES_ATTENTION` and health turns unhealthy;
- expired lease is reclaimable;
- finalization failure after storage deletion leaves the durable lease/recovery path intact and does not restore an active `StoredFile` row;
- independent health detects an intentionally overdue queue when the worker is withheld.

Do not use production files, users, buckets or credentials for fault injection.

## Rollback / stop condition

If staging durable behavior is unhealthy:

1. stop new durable enqueue by setting `IB_FILE_DELETION_MODE=legacy`;
2. keep the additive tombstone table in place;
3. do **not** drop the enum/table as an emergency rollback;
4. inspect/drain/reconcile already-enqueued tombstones through the durable worker or controlled operator procedure;
5. retain scheduler health visibility until the queue is reconciled.

A mode rollback does not reverse an object deletion that already succeeded. Never recreate an active file row merely to make the request appear successful.

Production activation requires a separate exact-SHA review, migration review and explicit approval after staging evidence is complete.

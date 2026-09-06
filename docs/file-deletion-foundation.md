# Durable client-file deletion — Phase 1

This foundation is intentionally **not wired into runtime routes** yet.

It introduces the domain contracts and lease/retry processor used by the future durable deletion lifecycle while keeping the current staging database and interactive DELETE path unchanged.

Before activation, the project still requires a separately reviewed additive `StoredFileDeletion` migration, Prisma repository implementation, staging-only migration application/verification, protected maintenance scheduling, provider idempotency verification, download/delete serialization, and fault-injection E2E.

A processor finalization failure must never restore the active file row after external deletion may have succeeded. The PROCESSING lease remains the durable recovery mechanism until the repository can atomically record `file.deleted` together with `COMPLETED`.

# File retention implementation gap review — 2026-10-13

## Scope reviewed

Read-only source review on `feature/document-intake-retention-20261013`. No database or storage changes were made.

Relevant code inspected:
- `server/domain/files/retention-policy.ts`
- `server/domain/files/deletion-request-service.ts`
- `server/domain/files/deletion-worker.ts`
- `server/repositories/prisma/stored-file-deletion-repository.ts`
- `app/api/internal/maintenance/file-deletions/route.ts`
- `prisma/schema.prisma` and `prisma/document-revisions.prisma`

## Current state

- The policy helper calculates a client-authorized choice after case completion: immediate deletion, or deletion five calendar years after `ClientCase.closedAt`.
- `ClientCaseFileRetentionDecision` is modeled and a migration exists on this branch. A domain decision service, immutable decision persistence, and a due-case worker are implemented on the feature branch. The Prisma repository serializes decision creation with upload registration, queues eligible files for durable deletion, waits for object-storage completion, retries lease-protected work, then removes questionnaire answers and generated-document source payloads in the same transaction that marks retention complete. A protected maintenance route and default-disabled five-minute scheduler are present. There is still no client endpoint or UI flow.
- The existing durable deletion queue processes an individual `StoredFile` after a deletion request. Its maintenance route processes one queue item per request.
- GitHub Actions runs the existing durable file-deletion queue every five minutes through a target-guarded maintenance runner. The new retention scheduler is separately guarded by `IB_FILE_RETENTION_SCHEDULER_ENABLED` and only queues due files; the existing deletion scheduler must also be enabled to remove their objects.
- The current per-file queue removes the database `StoredFile` row before asynchronous object-storage deletion. It retains deletion metadata for audit and retry.
- Generated document revisions (including `sourceData`, review notes, and revision metadata) are stored in `CaseDocumentRevision`; questionnaire answers are stored in `CaseQuestionnaire.answers`. The worker deletes all document revision rows and the questionnaire row after object deletion succeeds. The case/document metadata rows, account data, practicum/task text, notifications, payment records, and audit/tombstone metadata remain. OCR is not yet connected. Exported/submitted copies outside `StoredFile`, scanner temporary files, backups, logs, and processor copies still need confirmation.

## Required implementation before enabling the policy

1. Add a client-only endpoint and UI choice for a completed case. Persist the choice, policy version, completion date, decision date, and calculated deadline transactionally and idempotently.
2. Add a retention worker that claims due cases safely and enqueues every eligible uploaded object through the existing durable deletion path. It can reuse the target-guarded maintenance runner pattern, while keeping due-case claiming retryable, bounded, observable, and safe against concurrent runs.
3. The proposed client-facing scope and wording are now recorded in `docs/document-retention-inventory.md`. Before release, confirm exports/submitted copies, OCR outputs, scanner temporaries, backups and processors; decide retention/deletion for case messages, tasks, notifications, account, payment, security and audit data. Expand the worker only after the full scope and exceptions are approved.
4. Prevent new uploads or regeneration for cases whose retention decision is due or whose deletion is processing.
5. Add repository and integration coverage for owner authorization, duplicate requests, deadline boundaries, partial storage failures, retries, concurrent claims, and complete data-scope deletion.
6. Validate the complete migration history and current restore readiness before any staging apply. The current 11-migration history fingerprint is not owner-approved and is not configured; staging remains unchanged.

## Release gate

The due-file worker and its schedule are implemented on the feature branch, but the schedule is default-disabled and the database migration has not been applied. The current worker covers uploaded `StoredFile` objects, questionnaire answers, and document revision rows; it does not delete every personal-data category or confirmed backup/processor copies. Do not describe automatic deletion after five years as active until the full data-scope cleanup, client-facing choice, database-backed tests, migration approval, and operational checks are implemented and verified.

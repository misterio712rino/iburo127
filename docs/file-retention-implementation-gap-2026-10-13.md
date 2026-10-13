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
- `ClientCaseFileRetentionDecision` is modeled and a migration exists on this branch. A domain decision service and idempotent Prisma repository have now been added with tests for owner authorization, immutable retries, and conflicting choices. There is still no client endpoint or UI flow; the service is not exposed until the decision is connected to actual deletion.
- The existing durable deletion queue processes an individual `StoredFile` after a deletion request. Its maintenance route processes one queue item per request.
- GitHub Actions already runs the existing durable file-deletion queue every five minutes through a target-guarded maintenance runner. That runner processes queued objects; it does not select completed cases by retention deadline or enqueue their files.
- The current per-file queue removes the database `StoredFile` row before asynchronous object-storage deletion. It retains deletion metadata for audit and retry.
- Generated document revisions are stored in `CaseDocumentRevision.sourceData` (JSON), while questionnaire answers are stored in `CaseQuestionnaire.answers`. These are additional data stores to assess; deleting uploaded object storage files alone will not erase them.

## Required implementation before enabling the policy

1. Add a client-only endpoint and UI choice for a completed case. Persist the choice, policy version, completion date, decision date, and calculated deadline transactionally and idempotently.
2. Add a retention worker that claims due cases safely and enqueues every eligible uploaded object through the existing durable deletion path. It can reuse the target-guarded maintenance runner pattern, while keeping due-case claiming retryable, bounded, observable, and safe against concurrent runs.
3. Define and implement the deletion scope for associated generated document revisions, questionnaire answers, and any derived document outputs. Preserve only explicitly approved minimal audit records.
4. Prevent new uploads or regeneration for cases whose retention decision is due or whose deletion is processing.
5. Add repository and integration coverage for owner authorization, duplicate requests, deadline boundaries, partial storage failures, retries, concurrent claims, and complete data-scope deletion.
6. Validate the complete migration history and current restore readiness before any staging apply. The current 11-migration history fingerprint is not owner-approved and is not configured; staging remains unchanged.

## Release gate

The 5-year policy helper and the file-object deletion worker are foundations only. They do not yet enforce whole-case retention. Do not describe automatic deletion after five years as active until the endpoint, due-case scheduler, complete data-scope cleanup, and operational checks are implemented and verified.

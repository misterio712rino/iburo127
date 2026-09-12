# iБюро — State Migration Architecture

Branch: `audit/production-readiness`

## Goal

Move platform workflows from browser-local demo persistence to server-backed domain persistence without rewriting the current UI in one risky pass.

## Current browser state domains

### Questionnaire

Current storage:
- key prefix: `iburo.demo.questionnaire.v1.`
- payload: started flag, answers, completed section ids
- event: `iburo-questionnaire-progress`

Current hook: `components/platform/questionnaire/useQuestionnaireState.ts`

Production target:
- server-owned questionnaire aggregate scoped by `ClientCase`
- section progress and answers persisted independently from browser identity
- writes authorized against actor -> case access

### Practicum

Current storage:
- key prefix: `iburo.demo.practicum.v1.`
- payload: completed lesson ids
- event: `iburo-practicum-progress`

Current hook: `components/platform/practicum/usePracticumProgress.ts`

Production target:
- progress record scoped by `ClientCase` or enrollment/workflow context
- idempotent lesson completion mutations

### Documents

Current storage:
- key prefix: `iburo.demo.documents.v1.`
- payload: regeneration timestamps, sent-for-review ids, reviewed timestamps
- event: `iburo-document-state`

Current hook: `components/platform/documents/useDocumentState.ts`

Production target:
- document records with explicit lifecycle/status
- review actions authorized to assigned staff roles
- immutable history/audit events for consequential transitions

### Tasks

Current storage:
- key: `iburo.tasks.v1`
- payload: task id -> status
- event: `iburo-task-state`

Current consumers include manager and lawyer workspaces.

Production target:
- persistent Task model
- actor, assignment, case relation, due date, status, timestamps
- task transition history/audit events

## Migration principle

Do not make React components talk directly to Prisma.

Use this dependency direction:

UI components/hooks
  -> workflow service contract
  -> server action / route handler
  -> domain service
  -> repository
  -> Prisma/PostgreSQL

Demo mode can temporarily use:

UI components/hooks
  -> workflow service contract
  -> browser demo adapter

This preserves the existing interface while allowing each bounded workflow to migrate independently.

## Recommended service contracts

Keep contracts domain-specific rather than one generic storage abstraction.

### QuestionnaireService

Read:
- getState(caseId)

Mutations:
- start(caseId)
- setAnswer(caseId, fieldId, value)
- completeSection(caseId, sectionId)

### PracticumService

Read:
- getProgress(caseId)

Mutations:
- completeLesson(caseId, lessonId)

### DocumentService

Read:
- listDocuments(caseId)
- getDocument(caseId, documentId)

Mutations:
- regenerate(caseId, documentId)
- sendForReview(caseId, documentId)
- markReviewed(caseId, documentId)

### TaskService

Read:
- listForActor(actorId, filters)
- listForCase(caseId)

Mutations:
- startTask(taskId)
- completeTask(taskId)

## Authorization rule

Every server mutation must derive the authenticated actor on the server. Never accept user id, role, lawyer id, manager id, or case ownership as trusted browser claims.

Every case-scoped operation must verify access before repository reads/writes.

## Suggested database migration order

1. Questionnaire
2. Practicum progress
3. Tasks
4. Documents/review lifecycle
5. Activity/audit events
6. Notifications
7. File metadata/storage

Reasoning:
- questionnaire is the most structured source data and feeds documents;
- practicum is low-risk and validates the migration pattern;
- tasks are shared across staff roles and need server concurrency;
- documents require stronger audit and authorization guarantees.

## Important current risks

1. Browser storage can be edited manually.
2. Cross-device persistence does not exist.
3. There is no concurrency control.
4. Task state is duplicated across manager/lawyer consumers around the same storage key/event.
5. Document transitions currently store only derived browser timestamps rather than a durable audit trail.
6. Questionnaire and practicum rely on identity ids rather than database ClientCase ids.

## Implementation rule for next code steps

Before adding Prisma models, introduce thin domain service/adaptor boundaries around the current hooks. Preserve current UX and localStorage behavior in the demo adapter first. Only then add database-backed implementations.

Do not create one generic `useLocalStorage` abstraction as the production architecture; shared serialization helpers are acceptable, but domain contracts must remain explicit.

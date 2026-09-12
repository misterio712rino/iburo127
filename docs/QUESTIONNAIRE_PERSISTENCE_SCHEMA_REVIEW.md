# Questionnaire persistence schema review

Branch: `audit/production-readiness`

## Goal

Design the first persistent workflow around `ClientCase` without coupling the React UI directly to Prisma and without creating a broad migration.

The current questionnaire definition remains application-owned and versioned in code. Persistence stores a case-specific questionnaire state, not duplicate copies of field labels/options.

## Current questionnaire shape

The UI currently works with:
- `QuestionnaireAnswers = Record<string, string | number | boolean>`;
- ten sections identified by stable string IDs;
- conditional visibility between fields;
- section completion state;
- client-side demo persistence.

The persistence model must preserve this contract while making the database authoritative.

## Recommended first Prisma model

Proposed enum:

```prisma
enum QuestionnaireStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}
```

Proposed model:

```prisma
model CaseQuestionnaire {
  id                  String              @id @default(uuid()) @db.Uuid
  clientCaseId        String              @unique @db.Uuid
  schemaVersion       Int                 @default(1)
  status              QuestionnaireStatus @default(NOT_STARTED)
  answers             Json                @default("{}")
  completedSectionIds String[]            @default([])
  startedAt           DateTime?
  completedAt         DateTime?
  version             Int                 @default(1)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  clientCase ClientCase @relation(fields: [clientCaseId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([status])
  @@index([updatedAt])
}
```

`ClientCase` would receive:

```prisma
questionnaire CaseQuestionnaire?
```

## Why one case-level row first

For this MVP the questionnaire is a bounded aggregate belonging to exactly one `ClientCase`.

A JSON object is appropriate for answers because:
- field IDs are already stable application identifiers;
- the answer set is heterogeneous (`string | number | boolean`);
- conditional fields can be added without a migration per field;
- the UI already consumes the aggregate as one answer map;
- document generation also consumes the questionnaire as an aggregate.

This does **not** make JSON the authorization boundary. Access is still resolved through authenticated actor -> accessible `ClientCase` -> questionnaire.

## Why field definitions stay out of PostgreSQL

Labels, descriptions, select options, visibility conditions and section ordering are product configuration, not user-generated state. Duplicating them into the database now would create two sources of truth.

`schemaVersion` allows future questionnaire definition changes to be migrated explicitly.

## Concurrency

`version` is included for optimistic concurrency.

Expected write pattern:
1. client reads questionnaire version N;
2. write includes `expectedVersion = N`;
3. repository updates only when current version is N;
4. version increments to N+1;
5. mismatch returns a conflict instead of silently overwriting newer answers.

This matters once a client and staff member can review/edit the same case concurrently.

## Completion semantics

`status` transitions:
- `NOT_STARTED` -> `IN_PROGRESS` on first accepted answer or explicit start;
- `IN_PROGRESS` -> `COMPLETED` only when the domain service validates all currently applicable required fields/sections;
- reopening, if introduced later, must be an explicit domain operation rather than directly mutating `status`.

`completedAt` is set only by the completion operation, not inferred from the presence of answers.

## Authorization rule

Repository methods that mutate questionnaire data must never accept an arbitrary browser identity as authority.

Server flow:

```text
Session
  -> AuthenticatedActor
  -> ClientCaseService / case access check
  -> QuestionnaireService
  -> QuestionnaireRepository
  -> Prisma
```

CLIENT may access only questionnaire data for their own accessible case. LAWYER and MANAGER permissions for editing versus read-only review must be decided as explicit workflow policy before exposing staff mutations.

## Validation rule

Database storage does not replace questionnaire validation.

The domain service must validate:
- field ID exists in the active schema version;
- value type matches the field type;
- select/radio values are allowed options;
- conditional required fields are evaluated against the complete answer state;
- section completion is accepted only when that section has no validation errors.

## Sensitive-data considerations

Questionnaire content contains personal and financial data. Therefore:
- never expose the raw aggregate without case-scoped authorization;
- avoid logging answer payloads;
- errors should identify field IDs/status, not sensitive values;
- database backups/storage must use the managed PostgreSQL security controls;
- future audit events should record who changed a field and when without unnecessarily duplicating sensitive values.

## Deferred models

Do not add these in the first migration:
- per-field answer rows;
- answer revision history;
- staff comments;
- questionnaire attachments;
- generic audit event table.

Those should be introduced only when their workflow requirements are explicit.

## Migration plan

1. Review this model and domain contract.
2. Add only `QuestionnaireStatus` + `CaseQuestionnaire` + `ClientCase.questionnaire` to Prisma.
3. Run `prisma validate` and `prisma generate` before any database migration.
4. Generate migration SQL and review it before applying.
5. Implement `PrismaQuestionnaireRepository` with optimistic concurrency.
6. Implement server questionnaire service with case authorization and validation.
7. Add a server transport boundary (server action/route handler).
8. Switch the existing questionnaire workflow adapter from demo storage to server persistence.
9. Keep UI behavior and field definitions unchanged during the switch.

## Review decision

Recommended: **APPROVE FOR IMPLEMENTATION AS A SMALL, ISOLATED MIGRATION**, provided the migration SQL is reviewed before execution and no production database is altered automatically.

# iБюро — Database Baseline and Migration Plan

This document defines the safe path from the current repository schema to an authoritative PostgreSQL environment.

## Current repository schema additions

The production-readiness branch now models:

- `AuthIdentity` — explicit external auth identity mapping to internal `User.id`;
- `CaseQuestionnaire` — one questionnaire aggregate per `ClientCase`;
- `CasePracticumProgress` — one practicum progress aggregate per `ClientCase`;
- `CaseTask` + `TaskStatusEvent` — staff tasks and status history;
- `CaseDocument` — document lifecycle state per case/document code;
- `CaseActivityEvent` — case-scoped audit/activity events;
- `Notification` — per-user application notifications;
- `StoredFile` — private file metadata only, not storage bytes.

No migration from this branch has been applied to a production database.

## Preconditions

Before generating or applying migration SQL:

1. Confirm the authoritative PostgreSQL cluster and database name.
2. Confirm the deployment environment that will access it.
3. Verify the effective `DATABASE_URL` without exposing credentials in logs or commits.
4. Create a database backup/snapshot.
5. Inspect the live schema and existing data.
6. Determine whether the live database was created by Prisma migrations, manual SQL, `db push`, or another process.

## Baseline decision

### If the database already has Prisma migration history

- inspect `_prisma_migrations`;
- compare applied migrations with the repository schema;
- resolve drift before adding new migrations.

### If the database has tables but no Prisma migration history

Treat it as a pre-existing database:

1. introspect the authoritative schema;
2. create a baseline migration representing the already-existing objects;
3. mark only the baseline as applied using Prisma's supported migration resolution workflow;
4. generate subsequent migrations for new objects;
5. review SQL before execution.

Do not recreate populated tables merely to obtain migration history.

### If the target database is empty

Generate ordered migrations from the reviewed schema and apply them first in a non-production environment.

## Recommended migration order

Keep migrations small enough to review and roll forward safely:

1. `AuthIdentity`
2. `CaseQuestionnaire`
3. `CasePracticumProgress`
4. `CaseTask` and `TaskStatusEvent`
5. `CaseDocument`
6. `CaseActivityEvent`
7. `Notification`
8. `StoredFile`

Where multiple models are deployed together, the SQL must still be inspected for foreign keys, indexes, defaults and deletion behavior.

## SQL review checklist

For every migration verify:

- no unexpected `DROP TABLE`, `DROP COLUMN`, destructive cast or table recreation;
- UUID column types match referenced primary keys;
- unique constraints match domain invariants;
- foreign-key `ON DELETE` behavior is intentional;
- required columns either have safe defaults or the target table is new/empty;
- indexes exist for access-control and workflow query paths;
- enum changes are forward-compatible;
- JSON fields do not receive sensitive default payloads;
- no secret, questionnaire answer or document content is embedded in migration SQL.

## Deployment sequence

1. Generate migration SQL locally or in a controlled development environment.
2. Review the SQL in source control.
3. Apply to a disposable/non-production PostgreSQL database.
4. Run Prisma validation/generation, tests and application build.
5. Run workflow smoke tests against the migrated database.
6. Take/verify the production backup.
7. Apply the reviewed migration with the production deployment process.
8. Verify migration status and critical queries.
9. Only then enable the corresponding real-data route/UI adapter.

## Roll-forward policy

Prefer corrective forward migrations over manual production edits. If a migration is partially applied or fails, stop application rollout, capture the exact database state, and resolve using Prisma migration tooling plus reviewed SQL. Do not improvise with `db push` on production.

## Commands that are intentionally not run by this audit branch

- `prisma migrate dev` against production;
- `prisma db push` against production;
- destructive reset commands;
- automatic schema repair;
- any migration before the authoritative DB baseline is confirmed.

## External decisions still required

Migration execution depends on infrastructure facts that cannot be safely inferred from the repository:

- authoritative PostgreSQL endpoint/database;
- credential ownership and secret delivery;
- backup/snapshot mechanism;
- maintenance/deployment window;
- concrete auth provider;
- object storage provider for `StoredFile` objects.

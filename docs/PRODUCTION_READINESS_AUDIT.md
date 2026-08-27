# iБюро — Production Readiness Audit

Branch: `audit/production-readiness`
Base: `demo/investor-preview` @ `c843ba7`

## Status

The branch now contains the repository-side production foundation for authentication mapping, server authorization and the core persistent workflows, while preserving the investor demo as a separate presentation experience.

No production database migration, merge to `main`, production deployment, DNS change or production traffic switch has been performed from this branch.

## Completed repository foundation

### Authentication and identity

- provider-independent `SessionProvider` boundary;
- trusted external-session boundary (`ExternalSessionReader`);
- explicit external `(provider, subject)` -> internal `User.id` resolution;
- Prisma `AuthIdentity` model with unique `(provider, subject)`;
- active-user enforcement;
- roles resolved from internal PostgreSQL `UserRole` / `Role`, never from browser state or provider claims.

A concrete login/session vendor is intentionally not faked or hard-coded. Selecting/configuring the provider remains an external enablement step.

### Authorization

- server-side `AuthenticatedActor`;
- CLIENT / LAWYER / MANAGER access policy;
- query-level `ClientCase` scoping in the Prisma repository;
- defense-in-depth domain checks;
- protected workflow services and authenticated operations;
- untrusted payload parsing and safe transport error mapping;
- route-adapter contracts that take authoritative resource IDs from route parameters rather than browser JSON.

Demo route guards remain UX-only and are not considered authorization controls.

### Persistent workflow models and server layers

Repository/server foundations now exist for:

1. **Questionnaire**
   - `CaseQuestionnaire`;
   - schema versioning;
   - JSON answers + completed sections;
   - optimistic concurrency;
   - client-owner writes, authorized staff reads;
   - service, repository, operations, input, transport, HTTP and route-adapter layers.

2. **Practicum**
   - `CasePracticumProgress`;
   - completed lesson IDs, started/completed timestamps and version;
   - lesson-ID validation;
   - client-owner writes, authorized staff reads;
   - full server/transport/route-adapter foundation.

3. **Tasks**
   - `CaseTask`;
   - `TaskStatusEvent` history;
   - NEW / WORKING / DONE lifecycle;
   - manager access and assigned-lawyer scoping;
   - transactional status history and optimistic concurrency;
   - full server/transport/route-adapter foundation.

4. **Documents**
   - `CaseDocument`;
   - WAITING_DATA / DRAFT / READY_FOR_REVIEW / SENT_FOR_REVIEW / REVIEWED lifecycle;
   - readiness derived from required questionnaire fields;
   - client regeneration/submission and assigned-lawyer/manager review boundaries;
   - optimistic concurrency;
   - full server/transport/route-adapter foundation.

5. **Activity / audit**
   - `CaseActivityEvent`;
   - case-scoped read service;
   - trusted actor/system append service;
   - bounded primitive metadata;
   - authenticated read transport/route-adapter foundation.

6. **Notifications**
   - `Notification`;
   - per-user listing and ownership-scoped mark-read;
   - internal system creation service;
   - authenticated transport/route-adapter foundation.

7. **Stored file metadata**
   - `StoredFile`;
   - case ownership scope;
   - provider/object key/name/MIME/size/checksum metadata;
   - authenticated list/get;
   - trusted internal registration boundary;
   - BigInt converted to a JSON-safe string at transport level.

The repository deliberately does not implement a public upload endpoint or storage byte transport until an object-storage provider and private signed-access strategy are selected.

### UI migration boundaries

Client UI hooks no longer need to couple directly to concrete browser adapters for:

- questionnaire;
- practicum;
- documents.

Workflow service facades sit between UI hooks and the current demo adapters, allowing server adapters to replace browser persistence incrementally.

Shared task demo state has also been centralized behind its shared adapter/hook.

### Reliability / CI

CI now runs:

1. `npm ci`
2. Prisma schema validation
3. Prisma client generation
4. production-foundation tests
5. TypeScript `--noEmit`
6. ESLint
7. production build

Foundation tests cover the central case-access policy and questionnaire-definition invariants. Additional database integration/E2E tests must be added when an actual test database and real auth provider are enabled.

## What is intentionally NOT enabled yet

The following items require external infrastructure, credentials or product security decisions and therefore are not safely inferable from repository code:

### Concrete authentication provider

Still required:
- provider selection/configuration;
- trusted server-side session reader implementation;
- account enrollment/linking;
- recovery policy;
- MFA policy;
- provisioning `AuthIdentity` mappings.

Security invariant: email, browser user ID, browser role or demo identity must never become the production authorization key.

### Authoritative PostgreSQL baseline and migrations

The Prisma schema contains the production models, but they have **not** been applied to an authoritative database.

Before migration:
- confirm the real cluster/database;
- inspect current schema and `_prisma_migrations` state;
- take a backup/snapshot;
- establish a baseline if required;
- generate and review SQL;
- migrate a non-production database first;
- run smoke/integration tests;
- only then apply reviewed production migrations.

See `docs/DATABASE_BASELINE_AND_MIGRATION_PLAN.md`.

### Object storage

`StoredFile` persists metadata only. Still required:
- object-storage provider;
- private bucket/container configuration;
- signed upload/download strategy;
- content/type/size validation policy;
- malware scanning if required;
- retention/deletion policy.

### Production route activation

Server route-adapter contracts exist, but actual real-data Next.js route handlers/server actions remain disabled until a concrete trusted `SessionProvider` and migrated database are available.

This prevents accidentally publishing an endpoint backed by demo identity or fake authentication.

### Workflow event integration

Task status history is written transactionally.

For cross-workflow activity/audit events and notifications, the persistence foundations exist but critical mutation-to-event wiring should be implemented using a transactional/outbox-style approach once the database is active. A second independent write after a business mutation should not be relied on for mandatory audit records.

## Readiness classification

### Repository architecture: READY FOR REVIEW

The safe server architecture, persistence models, workflow boundaries and transport contracts are in place for the current MVP core.

### Investor demo: PRESERVED

The presentation experience remains separate from production authorization and can continue to be used while the production stack is enabled.

### Real production client data: NOT YET ENABLED

Blocked by external enablement rather than missing core repository architecture:

1. authoritative PostgreSQL baseline/migrations;
2. concrete authentication/session provider;
3. object storage for file bytes;
4. actual production route/UI adapter switch;
5. database-backed integration/E2E verification.

## Production enablement order

1. Confirm authoritative PostgreSQL and establish migration baseline.
2. Configure the concrete authentication provider and trusted session reader.
3. Apply reviewed migrations in staging/non-production.
4. Provision test users, roles, `ClientCase` records and `AuthIdentity` mappings.
5. Enable questionnaire route/UI server adapter and verify end-to-end.
6. Enable practicum.
7. Enable tasks.
8. Enable documents/review.
9. Enable activity and notifications with transactional/outbox event wiring.
10. Configure private object storage and then enable file upload/download.
11. Run security, cross-role and regression QA.
12. Review the exact release diff and green CI commit before any merge/deployment.

## Safety constraints

- do not modify or merge into `main` without final review;
- do not deploy this audit branch to production until external enablement gates are satisfied;
- do not apply Prisma migrations until the authoritative database baseline is confirmed;
- do not connect demo/localStorage identity to production routes;
- do not run `prisma db push` as a production migration shortcut;
- do not run broad dependency/security autofixes such as `npm audit fix --force` automatically;
- never trust client-supplied user identity, role or ownership;
- do not expose raw questionnaire answers, document contents, secrets or storage object keys in logs.

## Supporting documents

- `docs/AUTHORIZATION_ARCHITECTURE.md`
- `docs/AUTH_PROVIDER_INTEGRATION_REVIEW.md`
- `docs/STATE_MIGRATION_ARCHITECTURE.md`
- `docs/QUESTIONNAIRE_PERSISTENCE_SCHEMA_REVIEW.md`
- `docs/PRODUCTION_ENABLEMENT_CHECKLIST.md`
- `docs/DATABASE_BASELINE_AND_MIGRATION_PLAN.md`

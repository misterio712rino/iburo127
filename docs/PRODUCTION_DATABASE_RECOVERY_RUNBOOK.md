# iБюро — Production Database Backup, Restore and Rollback Runbook

## Purpose

This runbook defines the mandatory operational safety gate for the authoritative production PostgreSQL database before iБюро can be promoted to real production traffic.

It is a **release-control document**, not evidence that a production backup or restore has already been performed.

No production database mutation is authorized by this document. Production backup creation, restore testing, migration execution, failover, rollback, or infrastructure changes require the separate production approval defined by the project release process.

## Current readiness

**Status: BLOCKED / NOT YET PROVEN.**

Production database recovery readiness must remain blocked until all items in the `Release evidence` section are backed by real provider/runtime evidence.

Repository tests, Prisma validation, staging migration success, or a provider dashboard showing that backups are enabled are **not** substitutes for a verified restore.

## Scope

This runbook covers:

- the authoritative PostgreSQL database used by the production application;
- provider-managed backups/snapshots and point-in-time recovery, when supported;
- pre-migration backup verification;
- recovery into an isolated non-production target;
- schema/data integrity verification after restore;
- rollback decisions for application and database migrations;
- evidence that must be retained for the production release decision.

Object-storage recovery is a separate control and must not be inferred from PostgreSQL recovery readiness.

## Safety invariants

1. Never test restore by overwriting the authoritative production database.
2. Restore drills must target a new isolated database/cluster or another provider-supported isolated recovery target.
3. Never use `prisma db push`, destructive reset commands, Better Auth auto-migration, or ad-hoc SQL as a recovery shortcut.
4. Never log, commit, paste into tickets, or place in release evidence database passwords, connection strings, access keys, session tokens, personal data, questionnaire answers, generated-document content, or file object keys.
5. A backup is not considered usable until a restore from it has been demonstrated.
6. Application rollback and database rollback are separate decisions. Rolling the application back must not automatically reverse an already-committed database migration.
7. Prefer backward-compatible schema changes and corrective roll-forward migrations over destructive schema reversal.
8. If database state is uncertain after a failed migration, stop rollout and capture the exact state before any corrective action.

## Recovery objectives

Before production activation, the release owner must approve explicit values for:

- **RPO (Recovery Point Objective):** maximum acceptable production data loss;
- **RTO (Recovery Time Objective):** maximum acceptable time to restore usable service;
- backup retention period;
- point-in-time recovery retention/window, if supported by the selected PostgreSQL provider;
- restore-drill frequency;
- named operational owner and escalation path.

`UNKNOWN`, implicit provider defaults, or undocumented values are release blockers.

The approved values belong in operational configuration/evidence, not in application secrets.

## Backup policy gate

Before production activation, verify against the authoritative provider configuration that:

- automatic backups are enabled;
- retention satisfies the approved recovery policy;
- the backup schedule can meet the approved RPO;
- point-in-time recovery is enabled when required by the approved RPO;
- backup storage is provider-managed or otherwise isolated from ordinary application credentials;
- the application runtime credentials cannot delete backup history unless explicitly required and approved;
- provider/account access to backup and restore operations is restricted to authorized operators;
- the most recent successful backup timestamp is within policy;
- backup failures produce an operational alert or another reviewed escalation path.

Record only non-secret identifiers and timestamps in release evidence.

## Mandatory pre-migration gate

Before any reviewed production schema migration:

1. Reconfirm the exact release Git SHA.
2. Confirm CI and required release/security checks are green on that exact SHA.
3. Confirm the authoritative production database identity without printing credentials.
4. Inspect migration history and verify there is no unresolved drift or unfinished migration.
5. Review the exact migration SQL and its repository fingerprint.
6. Confirm the migration was already applied and verified in staging/non-production.
7. Confirm the latest production backup is healthy and within the approved RPO.
8. Create an on-demand pre-migration backup/snapshot when the provider and approved policy require it.
9. Record the non-secret backup/snapshot identifier and timestamp.
10. Confirm the tested restore procedure is still valid for the current PostgreSQL/provider configuration.
11. Define the application rollback version and the database roll-forward/rollback decision before execution.

If any item is not proven, **do not start the production migration**.

## Restore drill

A successful restore drill must be performed before first production launch and periodically thereafter according to the approved policy.

### 1. Select source recovery point

Choose a real backup/snapshot or point-in-time recovery point that is representative of the production configuration. Record:

- source backup identifier;
- source timestamp / recovery point;
- provider project/folder/cluster identifier in non-secret form;
- drill start timestamp.

### 2. Restore to an isolated target

Restore to a newly created isolated non-production target.

The target must:

- not receive production traffic;
- not replace or mutate the authoritative production database;
- use separate temporary access credentials where practical;
- be network-restricted to the drill operators/verifiers;
- be clearly labelled as recovery-test infrastructure.

### 3. Verify database identity

After restore, verify at minimum:

- expected database exists;
- PostgreSQL connection succeeds over the approved secure path;
- expected schema exists;
- `_prisma_migrations` state can be read;
- no unfinished migration is present;
- required Better Auth and iБюро tables/enums exist;
- database identity is the restored test target, not production.

Do not expose row payloads merely to prove restore success.

### 4. Verify structural integrity

Run read-only structural checks equivalent to the repository's reviewed database verification tooling where applicable.

Verify:

- migration history is internally consistent;
- required foreign keys/indexes/enums are present;
- Better Auth schema is compatible with the pinned application version;
- file lifecycle schema preserves the fail-closed scan states;
- critical unique constraints used by authorization/workflow code are present.

### 5. Verify bounded application functionality

Against the isolated restored target, use designated test identities/fixtures only. Verify at least:

- authentication/session lookup;
- role mapping;
- CLIENT own-case visibility;
- LAWYER assignment/plan restrictions;
- MANAGER intended read scope;
- questionnaire/practicum/task/document persistence reads;
- notification/outbox structural availability;
- READY-only file metadata visibility rules.

Do not send real customer email or invoke production external side effects during the drill.

### 6. Measure recovery time

Record:

- restore start timestamp;
- database-ready timestamp;
- verification-complete timestamp;
- measured restore duration;
- measured end-to-end recovery duration.

The drill passes only if the measured result satisfies the approved RTO or an explicit remediation is completed and a new drill passes.

### 7. Dispose of drill target safely

After evidence is captured and approved:

- revoke temporary drill credentials;
- remove temporary recovery infrastructure using the approved destructive-operation process;
- ensure no production routing points to the drill target;
- retain only non-secret evidence required by policy.

Deletion of the drill target itself is a destructive cloud action and must not be automated from the audit branch without authorization.

## Migration failure decision tree

### Failure before database mutation

If migration has not begun:

- abort rollout;
- leave production database untouched;
- diagnose in staging/non-production;
- generate a new reviewed release candidate.

### Migration fails before commit / provider reports no committed schema change

- stop application rollout;
- verify database state read-only;
- inspect `_prisma_migrations` and actual schema;
- do not retry blindly;
- correct migration tooling/SQL in a new reviewed candidate.

### Migration partially applies or database state is uncertain

- freeze further schema changes;
- capture exact migration history and structural state;
- keep or restore the previously compatible application version when safe;
- determine whether the safest action is a reviewed corrective forward migration or an isolated restore;
- do not execute ad-hoc destructive SQL to make Prisma appear green.

### Migration succeeds but new application release fails

Prefer **application rollback** to the last known-compatible immutable deployment when the migrated schema remains backward compatible.

Do not reverse the database merely because the application was rolled back.

If the previous application is not compatible with the migrated schema, stop traffic promotion and follow the pre-reviewed migration recovery plan.

### Data corruption or unrecoverable schema failure

A production database restore is an incident action, not an ordinary deployment step.

Before restoring the authoritative target:

- declare/record the incident;
- stop writes or otherwise control traffic as required by the incident plan;
- identify the approved recovery point and resulting data-loss window;
- obtain explicit production/destructive-operation authorization;
- restore using the provider-supported recovery mechanism;
- verify database identity, migration state and critical application invariants before reopening traffic.

## Rollback compatibility requirement

Every production migration review must classify the change as one of:

- **backward compatible** — previous application can safely run against the new schema;
- **expand/contract staged** — compatibility requires multiple releases and destructive contraction is deferred;
- **non-backward-compatible** — requires a separately reviewed maintenance/cutover and recovery plan.

Unknown compatibility blocks production deployment.

For ordinary releases, prefer additive/expand-first changes:

- create new nullable/default-safe columns/tables first;
- deploy code that can tolerate old and new states where necessary;
- backfill through controlled jobs when required;
- remove old schema only in a later separately reviewed release.

## Release evidence

Production database recovery readiness is PASS only when the release record contains, without secrets or customer payloads:

- authoritative provider/project/cluster/database identifiers;
- approved RPO;
- approved RTO;
- approved backup retention;
- approved PITR window or explicit `not required` decision;
- latest healthy automatic backup timestamp;
- pre-release/pre-migration backup identifier when required;
- restore-drill source identifier/recovery point;
- isolated restore target identifier;
- restore-drill start/database-ready/verification-complete timestamps;
- measured recovery duration;
- structural verification result;
- bounded application verification result;
- exact application Git SHA used for compatibility verification;
- named approving operator/release owner;
- rollback compatibility classification for the release;
- final PASS/FAIL decision.

A provider screenshot saying `backup enabled` without restore evidence is insufficient.

## First-production-launch gate

Before first production launch, all of the following are mandatory:

- [ ] authoritative production PostgreSQL target confirmed;
- [ ] automatic backup policy verified;
- [ ] RPO approved;
- [ ] RTO approved;
- [ ] retention approved;
- [ ] PITR policy approved;
- [ ] restore procedure tested against an isolated target;
- [ ] measured restore meets RTO;
- [ ] restored data point meets RPO;
- [ ] migration history verified after restore;
- [ ] critical authorization/application checks passed on restored target;
- [ ] rollback-compatible application version identified;
- [ ] exact release migration SQL reviewed and staging-proven;
- [ ] pre-migration production backup/snapshot verified when required;
- [ ] operational owner/escalation path assigned;
- [ ] production change separately approved.

Until every applicable item is evidenced, database recovery readiness remains **FAIL/BLOCKED**.

## Relationship to existing repository controls

This runbook complements, and does not replace:

- `docs/DATABASE_BASELINE_AND_MIGRATION_PLAN.md`;
- `docs/DATABASE_BASELINE_INSPECTION.md`;
- `docs/DATABASE_MUTATION_SAFETY.md`;
- `docs/MIGRATION_SQL_REVIEW_GATE.md`;
- `docs/STAGING_MIGRATION_DEPLOY.md`;
- `docs/STAGING_POST_MIGRATION_VERIFICATION.md`;
- `docs/PRODUCTION_ENABLEMENT_CHECKLIST.md`.

Staging success proves migration/application compatibility on the staging target. It does **not** prove production backup health or recoverability.

# iБюро — Post-migration staging verification

This runbook defines the read-only verification that must run immediately after reviewed Prisma migrations are applied to staging.

## Command

```bash
npm run db:verify:staging
```

Required environment variables include the guarded staging database target:

```text
DATABASE_URL=<staging PostgreSQL connection string>
IB_DB_TARGET=staging
IB_STAGING_DATABASE_HOST=<exact staging host>
IB_STAGING_DATABASE_NAME=<exact current_database() value>
IB_STAGING_DATABASE_USER=<exact current_user value>
```

The target guard runs before the verifier connection. The verifier then opens a `BEGIN READ ONLY` transaction and rolls it back after inspection.

## What is verified

The command verifies:

1. The connected database name exactly matches `IB_STAGING_DATABASE_NAME`.
2. The connected database user exactly matches `IB_STAGING_DATABASE_USER`.
3. All required iБюро domain tables exist in the `public` schema.
4. All required PostgreSQL enums from the current Prisma domain schema exist.
5. `StoredFile` contains every required malware-scan queue/lease/retry column from the current security contract.
6. `StoredFileStatus` contains every required lifecycle value: `PENDING_UPLOAD`, `PENDING_SCAN`, `SCANNING`, `READY`, `QUARANTINED`, `SCAN_FAILED`.
7. `_prisma_migrations` exists and contains at least one successfully applied migration.
8. `_prisma_migrations` contains no unfinished migration whose `finished_at` and `rolled_back_at` are both null.

The verifier does not read questionnaire answers, document contents, file contents, credentials, emails, phones or other client payloads.

## Why the file-scan checks are mandatory

The application intentionally authorizes normal file list/get/download operations only for `StoredFile.status = READY`. Upload completion now stops at `PENDING_SCAN`; only a scanner-confirmed `CLEAN` verdict may create `READY`.

A staging database that lacks the scan columns or lifecycle enum values cannot enforce this state machine and must therefore fail the release schema gate rather than be treated as compatible.

## Scope

This command verifies the iБюро domain schema and authoritative Prisma migration-history conditions. Better Auth owns a separate authentication schema lifecycle and must still be reviewed and verified separately before authentication is enabled for real staging users.

Absence of `_prisma_migrations`, zero successfully applied migrations, or any unfinished migration is a hard verification failure. It is not converted into a warning.

## Required order after migration

```text
npm run db:deploy:staging
npm run db:verify:staging
npm run check:staging
npm run check:staging:authz
```

For the private-file subsystem, also complete the external gates in `docs/FILE_UPLOAD_SECURITY.md`: private Object Storage verification, controlled scanner service, file-scan scheduler, clean/quarantine fixtures, retry/lease recovery and alerting.

Then run DB-backed authenticated E2E for CLIENT, LAWYER and MANAGER.

A successful schema verification is not production approval. It only confirms that the expected domain structures and migration-history invariants are present; provider runtime behavior, authorization E2E and operational alerting remain separate gates.

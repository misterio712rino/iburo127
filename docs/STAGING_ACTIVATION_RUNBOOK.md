# iБюро — Staging Activation Runbook

Purpose: activate the production-oriented backend safely in a non-production environment before any real-client traffic.

## Hard stop conditions

Do not proceed to any **mutation** phase if any of these are unknown:

- authoritative staging PostgreSQL host, database name and database user;
- verified backup/snapshot point;
- staging deployment hostname;
- Better Auth secret and base URL configuration;
- private Yandex Object Storage staging bucket and dedicated service-account/static-key credentials;
- controlled HTTPS staging malware scanner and independent scanner secret;
- dedicated Yandex Cloud Postbox staging sender and service-account/static-key credentials.

Read-only baseline inspection may be used to discover the current staging DB state before DDL, but it must still pass the exact staging target guard below.

Never substitute production credentials while validating staging.

## Staging target identity guard

Every staging DB command must be configured with all of the following:

```text
IB_DB_TARGET=staging
IB_STAGING_DATABASE_HOST=<exact host from DATABASE_URL>
IB_STAGING_DATABASE_NAME=<exact database from DATABASE_URL>
IB_STAGING_DATABASE_USER=<exact user from DATABASE_URL>
IB_STAGING_BETTER_AUTH_SCHEMA=<exact Better Auth schema, normally public>
```

The repository performs a network-free preflight against `DATABASE_URL` before staging DB verification, baseline inspection, staging AuthIdentity provisioning, and `prisma migrate deploy`. A host/database/user mismatch fails closed before PostgreSQL is contacted.

Run the guard directly with:

```bash
npm run check:staging:target
```

## Phase 0 — Environment inventory and read-only infrastructure preflight

Before making any staging network request, inspect configuration completeness with:

```bash
npm run staging:env:inventory
```

This inventory is network-free and never prints environment values. It prints only phase readiness, variable-name lists for missing/placeholder values, and aggregate counts. To inspect only the database prerequisites:

```bash
npm run staging:env:inventory -- --phase=database
```

The inventory is diagnostic only; it does not replace the exact target guards used by the real staging commands.

After the required staging-only values from `.env.example` have been configured, run:

```bash
npm run check:staging
```

This gate is read-only. It validates the staging runtime configuration and Object Storage metadata policy without running migrations, provisioning identities, enumerating/downloading/uploading/deleting objects, mutating bucket configuration, or sending email.

Expected terminal marker:

```text
STAGING_READINESS_PASS
```

If it fails, stop and fix staging identity/connectivity/security configuration before any DDL or provisioning.

## Phase 1 — Database baseline and reviewed migration

### 1.1 Public-safe baseline summary

Run first:

```bash
npm run db:inspect:baseline:summary
```

The command is staging-only, opens `BEGIN READ ONLY`, verifies connected database/user identity, and prints only aggregate counts plus one classification:

- `A_EMPTY_DATABASE`
- `B_EXISTING_DOMAIN_SCHEMA`
- `C_PRISMA_HISTORY_PRESENT`
- `D_AUTH_SCHEMA_ONLY`
- `REVIEW_NONEMPTY_OTHER_SCHEMA`

It does not print the database URL, target host/name/user values, arbitrary discovered table names, columns, indexes, constraints or defaults.

`A_EMPTY_DATABASE` is intentionally conservative: it is emitted only when the tracked user schema contains no relations/views/sequences/composite relations, enum/domain types, routines or collations. `0 base tables` alone is not enough.

### 1.2 Full structural baseline when required

For every classification except `A_EMPTY_DATABASE`, capture the full baseline on a trusted machine:

```bash
npm run db:inspect:baseline > database-baseline.json
```

The full inspector is read-only but intentionally refuses to run when `GITHUB_ACTIONS=true`, because this repository is public and the structural snapshot must not be exposed in public Actions logs/artifacts.

Do not commit `database-baseline.json` to this repository.

Interpretation:

- `B_EXISTING_DOMAIN_SCHEMA` → represent the real pre-existing state; do not blind-init or recreate populated tables.
- `C_PRISMA_HISTORY_PRESENT` → reconcile existing `_prisma_migrations` names/checksums/state before creating new history.
- `D_AUTH_SCHEMA_ONLY` → preserve Better Auth provider objects and verify them separately; domain baseline must not replace them.
- `REVIEW_NONEMPTY_OTHER_SCHEMA` → identify legacy/provider/extension objects before generating any migration.

### 1.3 Backup and migration design

Before any DDL:

1. create/verify a staging snapshot or backup and document the restore path;
2. compare the authoritative baseline with `prisma/schema.prisma`;
3. generate the real migration history only after the baseline strategy is resolved;
4. inspect the migration history fingerprint:

```bash
npm run db:inspect:migrations
```

5. manually review SQL:

```bash
npm run db:review:sql
```

6. set `IB_STAGING_MIGRATION_HISTORY_SHA256` to the exact reviewed migration-history SHA-256. Any later SQL/history change invalidates the pin and blocks mutation paths.

Do not create fake migrations merely to make `db:check:migrations` pass.

### 1.4 Apply reviewed staging migration

Set the explicit staging confirmation token:

```text
IB_STAGING_MIGRATION_CONFIRM=MIGRATE:<IB_STAGING_DATABASE_NAME>
```

Then run:

```bash
npm run db:deploy:staging
```

The command requires the pinned reviewed migration history, re-runs the exact staging target guard, verifies the connected database identity, and only then invokes `prisma migrate deploy` against staging.

After application, run:

```bash
npm run db:verify:staging
```

Do not continue if migration history contains unfinished entries or the required domain schema contract is incomplete.

## Phase 2 — Better Auth wiring

1. Verify the Better Auth schema on staging with `npm run check:staging:auth-schema`.
2. Do not use Better Auth auto-migration against production. Provider SQL must be generated/reviewed as part of the controlled schema plan.
3. Configure password recovery/email delivery before declaring recovery production-ready.
4. Enroll TOTP 2FA for LAWYER and MANAGER accounts before staff routes are considered production-ready.
5. Link verified Better Auth subjects to internal users only through the staging-only guarded command:

```bash
npm run auth:link:staging
```

6. Verify that suspended/roleless internal users resolve to no platform access.
7. Exercise repeated staging auth requests and verify database-backed rate limiting returns the expected 429 behavior across application instances before calling brute-force protection runtime-verified.

## Phase 3 — Private Object Storage

Run:

```bash
npm run check:staging:storage
```

The verifier is read-only and checks:

- exact staging bucket identity guard;
- exact staging Object Storage access-key ID guard;
- no public `AllUsers` / `AuthenticatedUsers` ACL grants;
- bucket policy: absent/deny-only can pass automatically, any `Allow` semantics require manual policy review;
- exact-origin CORS required by the signed browser `PUT` flow;
- no object enumeration/content operation is performed.

A green repository CI proves only that the verifier compiles. The remote staging bucket is not verified until the command is actually executed with staging credentials.

## Phase 4 — Malware scanner smoke verification

After the private staging bucket has passed Phase 3, prepare two dedicated benign security fixtures under:

```text
security-fixtures/file-scanner/
```

One fixture must be known-clean. The second must be a standard benign antivirus-detection artifact such as EICAR or the equivalent supported by the selected scanner; do not use real malware.

Configure the staging scanner origin/secret fingerprint, exact storage bucket/access-key guards, fixture object keys and single-run confirmation described in `docs/STAGING_FILE_SCANNER_VERIFICATION.md`, then run:

```bash
npm run check:staging:file-scanner
```

The verifier performs only two `HeadObject` calls, two local short-lived GET signatures and two scanner requests. It does not upload, delete, list or print fixture objects and does not access the application database.

Required outcomes:

- clean fixture -> exactly `CLEAN`;
- benign detection fixture -> exactly `MALICIOUS`.

Do not continue file-workflow activation if either verdict is wrong or if scanner/storage target identity cannot be proven.

## Phase 5 — Postbox delivery simulator

Postbox verification is an active provider-side send and therefore remains separate from the aggregate release gate.

Use only a dedicated staging sender/service account/static key. Configure the exact sender and key-id guards, then set:

```text
IB_EMAIL_TARGET=staging
IB_STAGING_POSTBOX_CONFIRM=SIMULATOR:<IB_STAGING_POSTBOX_FROM_EMAIL>
```

Run:

```bash
npm run check:staging:email-delivery
```

The recipient is hardcoded to `success@simulator.pstbx.ru`; it cannot be replaced through environment variables. A successful run sends no message to a real user. Clear `IB_STAGING_POSTBOX_CONFIRM` after the check.

See `docs/STAGING_POSTBOX_VERIFICATION.md` for the exact target-identity guard and timeout/error-handling contract.

## Phase 6 — Workflow activation

Activate one workflow at a time:

1. Questionnaire.
2. Practicum.
3. Tasks/history.
4. Documents/review lifecycle.
5. File metadata/storage/quarantine.
6. Activity/audit.
7. Notifications.

For each workflow, use server-derived actor identity, authoritative `ClientCase.id`, explicit optimistic concurrency, and cross-role authorization checks.

## Phase 7 — Security/application E2E matrix

Minimum matrix:

- CLIENT owner can access own case only;
- another CLIENT cannot;
- assigned LAWYER can access assigned case only;
- another LAWYER cannot;
- MANAGER follows the current practice-wide policy;
- roleless/suspended users receive no case data;
- browser-supplied user id, role, tariff or ownership claims have no effect;
- inaccessible cases cannot obtain signed file downloads;
- `PENDING_UPLOAD`, `PENDING_SCAN`, `SCANNING`, `QUARANTINED` and `SCAN_FAILED` files cannot obtain normal file downloads;
- upload completion rejects missing or size/type-mismatched objects and never sets `READY`;
- scanner `CLEAN` is the only route to `READY`;
- scanner `MALICIOUS` produces `QUARANTINED`;
- scanner outage/retry does not expose a file;
- questionnaire/document contents are absent from runtime logs/error responses.

Once migrated staging identities and dedicated mutable fixtures exist, run the explicit application E2E gate:

```bash
npm run check:staging:application-e2e
```

This command is intentionally **not read-only**. It performs HTTP authorization checks and controlled staging mutations/audit verification. Its mutation stage is protected by the network-free `check:staging:http-mutation-preflight` and requires the exact `MUTATE:<staging-host>` confirmation plus dedicated staging case/task fixtures. Optional private-file and CLEAN-scan E2E have additional independent opt-ins/confirmations.

It does not deploy migrations, send Postbox mail, call the OpenAI provider, or run the standalone storage/scanner smoke verifiers. Those remain separate target-guarded gates.

Expected terminal marker:

```text
STAGING_APPLICATION_E2E_PASS
```

See `docs/STAGING_APPLICATION_E2E.md` for the exact fixture and confirmation contract.

## Phase 8 — Full staging release gate

After schema, Better Auth tables and controlled staging fixtures exist, run:

```bash
npm run check:staging:release
```

This aggregate staging release gate runs:

- pinned migration-history verification;
- staging core readiness;
- domain schema verification;
- Better Auth schema verification;
- Object Storage security verification;
- active CLEAN/MALICIOUS malware-scanner fixture verification;
- staging AuthIdentity/role/case fixture verification;
- Bitrix24 target/schema verification.

The scanner portion is active because the scanner fetches two short-lived signed staging fixture URLs. The gate does not mutate the application database or Object Storage.

It intentionally does not send a Postbox simulator message, OpenAI smoke request, or run the mutating application E2E command; run `check:staging:email-delivery`, `check:staging:ai-provider`, and `check:staging:application-e2e` separately when validating those paths.

Expected terminal marker:

```text
STAGING_RELEASE_READINESS_PASS
```

A staging candidate is acceptable only when the exact commit also has green GitHub Actions CI, reviewed migration SQL, successful staging migration, successful `check:staging:application-e2e`, runtime error review, a successful dedicated staging Postbox simulator check, required AI/provider checks for enabled AI workflows, and a documented rollback point.

This runbook does not authorize merging to `main`, migrating production, changing DNS, changing the production bucket, using production Postbox/scanner/storage credentials, or deploying production traffic.

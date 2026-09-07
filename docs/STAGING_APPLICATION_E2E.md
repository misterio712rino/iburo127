# iБюро — Active staging application E2E

Purpose: run the authenticated application-level staging verification after the staging schema, Better Auth identities and dedicated synthetic fixtures are ready.

This command is intentionally separate from `npm run check:staging:release` because it performs authenticated workflow mutations against the dedicated staging fixture case.

Run:

```bash
npm run check:staging:application-e2e
```

## Execution order

The aggregate executes exactly:

1. `npm run check:staging:http-authz`
2. `npm run check:staging:http-ai-authz`
3. `npm run check:staging:http-mutations:audit`

Expected final marker:

```text
STAGING_APPLICATION_E2E_PASS
```

The mutation+audit stage itself begins with the network-free `check:staging:http-mutation-preflight` and therefore refuses to perform any HTTP mutation until the staging target, confirmation token and required fixtures are valid.

## Required staging fixtures

At minimum configure the authenticated CLIENT, LAWYER and MANAGER staging sessions plus the case/task fixtures documented in:

- `docs/STAGING_HTTP_MUTATION_E2E.md`
- `docs/STAGING_HTTP_MUTATION_AUDIT.md`

The command must use synthetic, dedicated staging cases and tasks only. Never substitute production sessions or production case data.

## File lifecycle levels

`IB_STAGING_FILES_E2E=0` keeps private-file mutation disabled.

With `IB_STAGING_FILES_E2E=1`, the mutation harness proves:

- signed upload preparation and direct staging-bucket PUT;
- completion enters `PENDING_SCAN`, never `READY`;
- unscanned file stays hidden from the normal READY-only list/get/download paths;
- cross-client access remains denied.

Full CLEAN lifecycle requires the separate explicit opt-in:

```text
IB_STAGING_FILE_SCAN_E2E=1
IB_STAGING_FILE_SCAN_E2E_CONFIRM=SCAN:<staging-host>
```

and a valid staging maintenance secret. The bounded worker execution then requires the real scanner to move the synthetic file through `CLEAN -> READY` before download is allowed.

The aggregate never manually changes `StoredFile.status` and never handles scan lease tokens.

## Deliberately excluded operations

This aggregate does **not** run:

- `db:deploy:staging` or any migration/seed command;
- Postbox simulator delivery;
- OpenAI provider smoke;
- Object Storage security metadata verification;
- scanner CLEAN/MALICIOUS smoke fixtures;
- Bitrix24 provider/schema verification;
- scheduler provisioning.

Those operations have separate target-identity and/or active-provider safety gates and must remain independently observable.

## Recommended staging sequence

After the authoritative database baseline is resolved and the reviewed staging migration has been applied:

```text
npm run db:verify:staging
npm run check:staging:auth-schema
npm run check:staging:release
npm run check:staging:application-e2e
```

Then run the separately guarded active providers required for enabled workflows, including Postbox and OpenAI.

A green repository CI proves only that this harness and its safety contracts compile and pass static/unit regression gates. `STAGING_APPLICATION_E2E_PASS` is valid only when the command has actually executed against the intended staging deployment and dedicated staging fixtures.

This document does not authorize production deployment, production database changes, merge to `main`, DNS changes or production credential use.

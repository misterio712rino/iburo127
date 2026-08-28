# iБюро — Staging HTTP mutation E2E

This runbook exercises the real authenticated staging HTTP mutation boundaries for questionnaire, practicum, documents, tasks and, when explicitly enabled, private object storage.

Command:

```bash
npm run check:staging:http-mutations
```

## Safety gate

The harness is intentionally mutation-capable and refuses to run unless all of the following are true:

```text
IB_STAGING_BASE_URL=https://<staging-host>
IB_STAGING_MUTATION_TARGET=staging
IB_STAGING_MUTATION_CONFIRM=MUTATE:<staging-host>
```

`iburo127.ru` and `www.iburo127.ru` are explicitly blocked. The confirmation must match the parsed host exactly, including a non-default port when one is used.

Never point this command at production. It does not apply migrations, call `prisma db push`, provision identities or change deployment configuration.

## Required authenticated fixtures

```text
IB_STAGING_CLIENT_COOKIE=<Better Auth Cookie header value for staging CLIENT>
IB_STAGING_LAWYER_COOKIE=<Better Auth Cookie header value for staging LAWYER>
IB_STAGING_MANAGER_COOKIE=<Better Auth Cookie header value for staging MANAGER>
IB_STAGING_MUTATION_CASE_NUMBER=<dedicated case owned by CLIENT and assigned to LAWYER>
IB_STAGING_MUTATION_TASK_ID=<dedicated NEW task assigned to LAWYER on that case>
```

The mutation case must be visible to all three fixture actors:

- CLIENT because the case is owned by that internal user;
- LAWYER because the same case is assigned to that internal user;
- MANAGER through the current manager case scope.

The questionnaire on this case must not be `COMPLETED`. The harness writes only fixed synthetic staging values and prepares the `property-inventory` document prerequisites itself.

Cookies are secrets. Never commit them, paste them into issues, or print them in CI logs. The harness deliberately logs only assertion labels/status codes and never response payloads, cookie values, signed URLs or object keys.

## Assertions

### Questionnaire

1. CLIENT `POST` get-or-create.
2. LAWYER and MANAGER can read the shared accessible case questionnaire.
3. CLIENT updates a canonical answer with the current `expectedVersion`.
4. A following GET must return the authoritative persisted value/version.
5. Reusing the stale version must return `409 VERSION_CONFLICT`.
6. LAWYER and MANAGER client-only mutations must return `403 FORBIDDEN`.
7. Synthetic fields needed by the document fixture are prepared through the same public authenticated API.

### Practicum

1. CLIENT `POST` get-or-create.
2. CLIENT completes canonical `lesson-1` with `expectedVersion`.
3. GET confirms the persisted lesson/version.
4. Reusing the stale version returns `409 VERSION_CONFLICT`.
5. LAWYER and MANAGER can read but cannot perform the client-only mutation.

Completing an already-completed lesson is safe for this fixture under the current repository contract: it keeps the lesson set stable and advances the optimistic-concurrency version.

### Documents

The harness uses canonical `property-inventory` and makes its required questionnaire fields present first.

1. CLIENT get-or-creates the document.
2. CLIENT regenerates it to `READY_FOR_REVIEW`.
3. A stale regenerate returns `409 VERSION_CONFLICT`.
4. LAWYER review before `SENT_FOR_REVIEW` returns `409 INVALID_TRANSITION`.
5. CLIENT sends for review.
6. CLIENT review is denied with `403 FORBIDDEN`.
7. Assigned LAWYER reviews successfully.
8. The document is regenerated/sent again and MANAGER review is verified.
9. CLIENT, LAWYER and MANAGER authoritative reads must agree on the final version.

### Tasks

The dedicated task must start in `NEW`.

1. LAWYER changes `NEW → WORKING`.
2. Reusing the stale version returns `409 VERSION_CONFLICT`.
3. CLIENT mutation returns `403 FORBIDDEN`.
4. MANAGER changes `WORKING → DONE` under the current staff policy.
5. GET confirms authoritative `DONE` state.
6. The harness restores the dedicated staging task to `NEW` through the current staff mutation contract so a successful run is repeatable.

If a previous run was interrupted after the task mutation, reset the dedicated staging fixture to `NEW` before rerunning. The harness will fail closed instead of silently normalizing an unexpected initial task state.

## Private file storage E2E

Storage execution is **off by default**. Without a real private staging bucket the command only reports that the file E2E contract is prepared and skips all storage mutation.

After the private staging Yandex Object Storage bucket is configured, explicitly add:

```text
IB_STAGING_FILES_E2E=1
IB_STAGING_PRIVATE_BUCKET_CONFIRM=PRIVATE_STAGING_BUCKET:<staging-host>
IB_STAGING_OTHER_CLIENT_COOKIE=<Better Auth Cookie header value for a different staging CLIENT>
```

The storage flow then verifies:

1. authenticated prepare-upload;
2. direct `PUT` to the short-lived signed URL;
3. server completion/HEAD verification;
4. `StoredFile READY` in authoritative list;
5. short-lived signed download and byte equality;
6. another CLIENT cannot get, download, or list files for the owner case.

The script never prints the signed upload/download URL, `objectKey`, or cookies. The storage test creates a tiny synthetic PDF fixture and currently leaves the READY staging row/object in place because there is no authenticated delete endpoint in the current file lifecycle.

## Recommended order

Run only after the read-only gates pass:

```text
npm run db:verify:staging
npm run check:staging
npm run check:staging:authz
npm run check:staging:http-authz
npm run check:staging:http-mutations
```

Enable `IB_STAGING_FILES_E2E=1` only after the private staging bucket and separate other-client fixture are confirmed.

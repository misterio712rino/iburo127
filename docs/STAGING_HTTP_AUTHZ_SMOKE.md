# iБюро — Staging HTTP authorization smoke

This runbook verifies the real deployed staging application through its authenticated HTTP API after the staging database, Better Auth identities and role fixtures exist.

## Scope

The smoke harness is intentionally read-oriented. It verifies authorization and case visibility without mutating questionnaire, practicum, documents, tasks or files.

Command:

```bash
npm run check:staging:http-authz
```

## Required environment

```text
IB_STAGING_BASE_URL=https://<staging-host>
IB_STAGING_CLIENT_COOKIE=<Better Auth Cookie header value for staging CLIENT>
IB_STAGING_LAWYER_COOKIE=<Better Auth Cookie header value for staging LAWYER>
IB_STAGING_MANAGER_COOKIE=<Better Auth Cookie header value for staging MANAGER>
IB_STAGING_CLIENT_CASE_NUMBER=<case visible only to the CLIENT fixture and manager>
IB_STAGING_LAWYER_CASE_NUMBER=<case assigned to the LAWYER fixture and visible to manager>
```

Cookies are secrets. Never commit them, paste them into issues, or print them in CI logs. Prefer short-lived staging sessions created immediately before the smoke run.

## Assertions

The harness checks:

1. unauthenticated `GET /api/platform/session` returns `401 UNAUTHENTICATED`;
2. CLIENT, LAWYER and MANAGER cookies resolve to the expected internal role through the real Better Auth → AuthIdentity → User/Role path;
3. private API responses include a `no-store` cache policy;
4. CLIENT can see its staging case but not the LAWYER-only case;
5. LAWYER can see the assigned staging case but not the CLIENT-only case;
6. MANAGER can see both fixture cases;
7. CLIENT receives `403` when requesting the staff task list.

The two fixture case numbers must be different for the cross-case denial assertions to be meaningful.

## Recommended order

Run after:

```text
npm run db:verify:staging
npm run check:staging
npm run check:staging:authz
```

Then run:

```text
npm run check:staging:http-authz
```

Only after this smoke passes should mutation-oriented browser/API E2E scenarios be enabled.

## Safety

This command does not provision accounts, modify the database, apply migrations, upload files or change workflow state. It sends GET requests to staging and consumes pre-created authenticated session cookies.

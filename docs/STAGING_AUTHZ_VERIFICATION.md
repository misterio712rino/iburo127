# iБюро — Staging authorization fixture verification

After staging migrations and controlled Better Auth account linking, run the read-only fixture verifier before browser E2E.

## Command

```bash
npm run check:staging:authz
```

Required environment variables:

- `DATABASE_URL`
- `IB_STAGING_CLIENT_USER_ID`
- `IB_STAGING_CLIENT_SUBJECT`
- `IB_STAGING_LAWYER_USER_ID`
- `IB_STAGING_LAWYER_SUBJECT`
- `IB_STAGING_MANAGER_USER_ID`
- `IB_STAGING_MANAGER_SUBJECT`

The verifier opens a PostgreSQL `READ ONLY` transaction and checks that:

- each fixture user exists and is `ACTIVE`;
- CLIENT / LAWYER / MANAGER roles exist on the expected internal users;
- each Better Auth subject maps through `AuthIdentity` to the expected internal user;
- the CLIENT owns at least one staging `ClientCase`;
- the LAWYER is assigned to at least one staging `ClientCase`.

The script does not print subjects, emails, phone numbers, questionnaire answers or document contents. It rolls the transaction back after verification.

## What this does not prove

This database-level preflight is not a substitute for authenticated HTTP/browser E2E. After it passes, verify at least:

1. CLIENT can read/write only their own case workflows.
2. A different CLIENT receives denial/not-found for another case.
3. Assigned LAWYER can read the assigned case and staff workflows but cannot perform CLIENT-only mutations.
4. Unassigned LAWYER cannot read another lawyer's case.
5. MANAGER can access allowed staff-wide case workflows.
6. Browser-supplied user ids, roles or ownership hints do not change the server actor.
7. Suspended users fail authentication/actor resolution even if their Better Auth session still exists.
8. Private file signed URLs cannot be obtained without case access.

Only after these checks should staging be considered authorization-ready for real-data parity testing.

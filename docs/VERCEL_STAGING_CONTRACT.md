# iБюро — Vercel Staging / Preview Contract

Purpose: define the only acceptable Vercel deployment shape for `audit/production-readiness` before any staging activation work.

## Current audited Vercel state

The connected Vercel project is:

- project: `iburo127-app`;
- project id: `prj_QlQsyUdlK6lesKu6Jr5EoewLTxvw`;
- team id: `team_3UOkJFulkAO9saUcOAPiW2uc`;
- framework: Next.js;
- configured Node runtime family: `24.x`.

At the time of this audit, every listed deployment belonged to `demo/investor-preview` and reported `target: production`. None belonged to `audit/production-readiness`.

Therefore existing deployment URLs are historical demo deployments and MUST NOT be treated as staging for the production-readiness branch.

## Required deployment identity

Any future staging deployment for this branch must satisfy all of the following:

1. Git branch is exactly `audit/production-readiness`.
2. Vercel deployment environment is Preview, never Production.
3. Deployment metadata identifies the exact candidate Git commit SHA being validated.
4. The deployment must not replace or alias an existing production domain.
5. The deployment must not be created with `--prod` or an equivalent production-target API operation.
6. Production domains, DNS, redirects and aliases remain unchanged unless separately authorized.
7. Historical `demo/investor-preview` deployments are not staging substitutes.

## Environment isolation

Vercel supports Preview environment variables scoped to a specific Git branch. Staging credentials for `audit/production-readiness` must use that isolation where Vercel-managed environment variables are used.

The staging branch must have dedicated non-production values for every external system it can contact, including at minimum:

- `DATABASE_URL` and all `IB_STAGING_DATABASE_*` identity guards;
- Better Auth secret/base URL;
- Yandex Object Storage bucket/access keys;
- malware scanner origin/secret/fingerprint;
- Yandex Cloud Postbox staging sender/access keys;
- OpenAI staging/project credentials when provider smoke tests are explicitly enabled;
- Bitrix24 staging webhook/portal configuration;
- maintenance secret;
- all staging confirmation tokens required by repository guards.

Do not copy production secret values into Preview merely because the variable names are the same.

`IB_VERCEL_PREVIEW_BACKEND_CONFIRM` is a provenance grant, not a branch-wide feature flag. It must never be configured as only `STAGING:audit/production-readiness`. After the initial disabled-backend identity check passes, its only accepted value is:

```text
STAGING:audit/production-readiness:<exact-40-character-candidate-sha>
```

The SHA suffix must equal the deployment's `VERCEL_GIT_COMMIT_SHA`. A later commit on the same branch is not authorized by the older confirmation and must fail closed until the complete candidate certification and activation sequence is repeated.

## Forbidden production-env shortcuts

For staging validation, do not use commands or settings that intentionally load Production environment variables, including production-target builds/deployments such as:

```bash
vercel deploy --prod
vercel build --prod
vercel pull --environment=production
```

A Preview deployment that receives production database/provider credentials is still unsafe and must be treated as a production-bound target failure.

## Required activation sequence

Before creating or using a staging Preview deployment:

1. Confirm the candidate repository SHA has fully successful exact-head GitHub Actions CI.
2. Configure branch-scoped Preview environment variables for `audit/production-readiness` using dedicated staging credentials only. Keep `IB_VERCEL_PREVIEW_BACKEND_CONFIRM` unset for the initial deployment.
3. Run the repository's network-free environment inventory on a trusted staging-capable machine:

```bash
npm run staging:env:inventory
npm run staging:env:inventory -- --phase=database
```

4. Do not proceed if any required value is missing or still a placeholder.
5. Create/use only the Preview deployment for the exact audit-branch candidate SHA.
6. Verify that exact Preview identity while the backend is still disabled:

```bash
npx --no-install tsx scripts/verify-vercel-preview-identity.ts <preview-url> <exact-candidate-sha> false
```

The check must return `VERCEL_PREVIEW_IDENTITY_PASS` and the endpoint must report the exact candidate SHA with `backendEnabled=false`.
7. Only after step 6 passes, configure the branch-scoped Preview confirmation as exactly:

```text
IB_VERCEL_PREVIEW_BACKEND_CONFIRM=STAGING:audit/production-readiness:<exact-candidate-sha>
```

8. Redeploy the **same exact candidate SHA** as Preview. Do not accept a redeploy whose Git SHA changed.
9. Re-run the identity verifier against the activated Preview and the same SHA:

```bash
npx --no-install tsx scripts/verify-vercel-preview-identity.ts <preview-url> <exact-candidate-sha> true
```

The check must return `VERCEL_PREVIEW_IDENTITY_PASS` with `backendEnabled=true`.
10. If `audit/production-readiness` advances to any new SHA, the previous confirmation is invalid by design. Repeat exact-head CI, initial disabled identity verification, confirmation rotation and enabled identity verification for the new SHA before backend access is allowed.
11. Record the resulting staging hostname; use it as the exact host input for application E2E confirmation guards.
12. The first real PostgreSQL operation remains:

```bash
npm run db:inspect:baseline:summary
```

This operation is read-only and must pass the staging database target guard.
13. Follow `docs/STAGING_ACTIVATION_RUNBOOK.md` from database baseline onward.

## Release boundary

A successful Vercel Preview deployment does not authorize:

- merging to `main`;
- promoting the Preview to Production;
- assigning production domains;
- modifying DNS;
- running production migrations or `prisma db push`;
- Better Auth production auto-migrations;
- changing production secrets;
- reusing staging credentials in Production.

Production release remains a separately approved operation with repository governance, verified release provenance, exact-head CI, reviewed migrations and staging E2E evidence.

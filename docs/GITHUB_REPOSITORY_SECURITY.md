# iБюро — GitHub Repository Security Contract

This document defines repository-level controls required before `main` can be used as a production release branch.

## Current audit finding

At the time this contract was added, the GitHub API reported:

- `main.protected = false`;
- branch protection disabled;
- required status checks disabled;
- repository rulesets list empty.

This is an external repository-governance condition. Repository code and a green CI run do not compensate for an unprotected release branch.

## Required state before any future production merge

`main` must be protected by GitHub branch protection or a repository ruleset that provides equivalent or stronger controls.

Minimum requirements:

1. Direct pushes to `main` are blocked for normal development.
2. Changes reach `main` through a pull request or another explicitly reviewed release mechanism.
3. The repository CI `validate` job is required and must succeed on the exact candidate commit before merge.
4. Force pushes to `main` are disabled.
5. Branch deletion for `main` is disabled.
6. Required checks cannot be bypassed as part of the normal release path.
7. Any administrative bypass is treated as a break-glass action and documented separately.
8. Production deployment, production PostgreSQL migrations, DNS changes, and production secrets remain outside the authority of this repository contract and require their own explicit release approval.

## CI supply-chain policy

External GitHub Actions used by repository workflows must be pinned to full lowercase 40-character commit SHAs.

The repository enforces this with:

```bash
npm run check:ci-action-pins
```

The check runs immediately after checkout and before `setup-node` in CI. Mutable refs such as `@main`, `@master`, `@v7`, release tags, or arbitrary branches fail closed.

Current approved action pins are documented inline in `.github/workflows/ci.yml` with human-readable release-version comments. Updating an action requires:

1. selecting an official stable release;
2. resolving that release tag to the exact commit SHA;
3. updating the SHA and release comment together;
4. obtaining a fully completed successful GitHub Actions run for the new exact repository HEAD.

## Exact-head rule

A historical successful workflow run must never be used to claim readiness for a newer commit.

For every meaningful repository change, readiness requires a fully completed successful CI run whose `head_sha` exactly matches the current `audit/production-readiness` HEAD.

## Staging and production separation

Repository governance does not authorize infrastructure mutation.

In particular, this document does not authorize:

- merging `audit/production-readiness` into `main`;
- modifying production deployment or domains;
- applying production PostgreSQL migrations;
- running `prisma db push` against production;
- running Better Auth auto-migrations against production;
- changing production secrets;
- reusing old investor-demo deployments as staging.

Until a dedicated staging environment and authoritative staging PostgreSQL target are available, overall production readiness remains externally blocked even when repository CI is green.

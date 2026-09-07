# iБюро — GitHub Repository Security Contract

This document defines repository-level controls required before `main` can be used as a production release branch.

## Current audit finding

The current repository governance audit found:

- `main.protected = false`;
- branch protection disabled;
- required status checks disabled;
- repository rulesets list empty;
- repository visibility is `public`;
- current audit-branch release candidate commits are not cryptographically verified by GitHub (`verification.verified = false`, reason `unsigned` at the audited exact HEAD).

This is an external repository-governance condition. Repository code and a green CI run do not compensate for an unprotected release branch, public source visibility, or an unverifiable release commit.

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

## Code ownership

Repository ownership is declared in `.github/CODEOWNERS`.

The default owner and the explicitly listed release/security-critical areas are assigned to `@misterio712rino`.

`CODEOWNERS` is only an ownership declaration until GitHub branch protection or an equivalent ruleset is configured to require code-owner review. Its presence must not be treated as enforcement while `main` remains unprotected.

## Release provenance

Before a production merge or production deployment is approved, the exact release candidate commit must have a verifiable provenance path.

Preferred contract:

1. the exact candidate commit has `verification.verified = true` in the GitHub commit API;
2. the commit identity corresponds to an authorized repository maintainer or to an explicitly trusted GitHub merge/signing mechanism;
3. the exact same SHA has a fully completed successful `validate` CI job;
4. no newer commit is substituted after approval without repeating verification and CI.

An `unsigned` commit is acceptable during development on the audit branch, but it must not by itself satisfy the final production release provenance requirement.

## Repository visibility

The repository currently reports `visibility = public`.

For a commercial application containing proprietary workflow, authentication/authorization architecture, integrations, and business logic, repository visibility must be an explicit release-governance decision. Converting the repository to `private` is an external administrative action and is not authorized by this document alone.

Private visibility also does not replace secret hygiene: credentials and production secrets must never be committed to Git, regardless of repository visibility.

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

## Secret exposure policy

Tracked repository content is scanned in CI before dependency installation.

The scanner rejects high-signal secret patterns and tracked environment files other than `.env.example`. Intentional test fixtures require a reviewed path-and-detector exception instead of broad directory exclusions.

A clean secret-exposure scan is a repository safeguard, not proof that historical commits or external secret stores have never contained credentials. Any confirmed leaked credential must still be rotated at its provider.

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
- changing repository visibility;
- changing branch protection or repository rulesets;
- reusing old investor-demo deployments as staging.

Until a dedicated staging environment and authoritative staging PostgreSQL target are available, overall production readiness remains externally blocked even when repository CI is green.

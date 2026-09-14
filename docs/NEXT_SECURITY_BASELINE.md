# Next.js security baseline — August 2026

## Decision

The production-readiness branch pins:

- `next` = `16.3.3`
- `eslint-config-next` = `16.3.3`

The previous runtime baseline was Next.js `16.2.10`.

## Security reason

Vercel's August 25, 2026 Next.js security release identifies `16.3.3` as the patched Active LTS release for two Critical vulnerabilities:

- `GHSA-p293-qw3h-jr36` — unauthenticated remote code execution affecting Next.js `>=16.0 <16.3.3` on Windows-hosted servers under the advisory's affected configuration;
- `GHSA-2xp9-vwfh-vxw4` — unauthenticated remote code execution in the Image Optimization path when AVIF files are processed, affecting Next.js `<16.3.3`.

No workaround is treated as a substitute for the patched framework version.

## Lockfile provenance

The lockfile was refreshed on a GitHub-hosted Node.js 24 runner using npm with install scripts disabled:

```text
npm install --package-lock-only --ignore-scripts --save-exact next@16.3.3
npm install --package-lock-only --ignore-scripts --save-dev --save-exact eslint-config-next@16.3.3
```

The one-shot helper verified `next`, `eslint-config-next`, `@next/env`, and `@next/eslint-plugin-next` at `16.3.3`, committed the npm-generated manifests, and removed itself. The net repository change from the pre-upgrade baseline contains only `package.json` and `package-lock.json` before this documentation commit.

## Acceptance criteria

The security upgrade is not considered complete merely because the manifests changed. The exact final branch SHA must pass the normal GitHub Actions pipeline:

1. `npm ci`;
2. runtime PII logging gate;
3. Prisma validate;
4. Prisma generate;
5. production foundation tests;
6. TypeScript;
7. ESLint;
8. production build.

## Deployment boundary

This upgrade does not authorize or perform:

- merge to `main`;
- production deployment;
- production database changes;
- production Object Storage changes;
- DNS changes.

Production remains unchanged until an explicit release decision.

# Better Auth distributed rate limiting

## Repository policy

Better Auth client-initiated authentication traffic must not rely on process-local in-memory counters in production-capable deployments.

The server configuration therefore uses:

```ts
rateLimit: {
  enabled: true,
  storage: "database",
  modelName: "rateLimit",
}
```

This keeps rate-limit state shared across application instances through PostgreSQL instead of resetting or diverging per Node.js process.

## Provider schema boundary

The physical `rateLimit` table belongs to the Better Auth provider schema together with the lowercase Better Auth tables `user`, `session`, `account`, `verification` and `twoFactor`. These provider-owned tables are deliberately kept out of the legal-domain Prisma schema so the application does not partially duplicate or accidentally rename Better Auth's database contract.

The `rateLimit` table contains only rate-limit infrastructure state:

- `id` — primary key;
- `key` — unique rate-limit key;
- `count` — request count in the active window;
- `lastRequest` — epoch-millisecond timestamp used by Better Auth.

The read-only staging Better Auth verifier is the repository gate for this provider schema. It requires `rateLimit`, its column types, primary key and unique `key` constraint before it can report PASS.

## Migration safety boundary

This repository change does **not** create the table in any database.

Do not run Better Auth automatic migrations, `prisma db push`, `prisma migrate dev`, or ad-hoc DDL against staging or production to enable this feature.

Activation order remains:

1. inspect the authoritative PostgreSQL baseline;
2. establish the reviewed migration strategy for legal-domain Prisma objects and Better Auth provider objects;
3. generate the Better Auth 1.7 provider schema/SQL for the pinned application configuration without applying it automatically;
4. manually review the generated SQL together with the authoritative database baseline and backup/rollback plan;
5. apply only the reviewed staging change through an explicitly approved staging mutation procedure;
6. run `npm run check:staging:auth-schema` and confirm the full Better Auth core + 2FA + rate-limit contract;
7. exercise controlled staging authentication traffic and verify HTTP 429 behavior under repeated requests and concurrent application instances;
8. only after staging evidence, include the change in a future production release review.

Until those runtime checks are complete, database-backed rate limiting is **code-complete foundation only**, not a claim that staging or production brute-force protection has been runtime-verified.

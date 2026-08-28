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

## Database contract

The provider-owned physical table is `rateLimit` and contains only rate-limit infrastructure state:

- `id` — primary key;
- `key` — unique rate-limit key;
- `count` — request count in the active window;
- `lastRequest` — epoch-millisecond timestamp used by Better Auth.

`prisma/schema.prisma` models this table as `AuthRateLimit` with `@@map("rateLimit")` so the future reviewed Prisma migration can include the provider table without renaming Better Auth's expected database object.

The read-only staging Better Auth verifier requires the table, column types, primary key and unique `key` constraint before it can report PASS.

## Migration safety boundary

This repository change does **not** create the table in any database.

Do not run Better Auth automatic migrations, `prisma db push`, `prisma migrate dev`, or ad-hoc DDL against staging or production to enable this feature.

Activation order remains:

1. inspect the authoritative PostgreSQL baseline;
2. establish the reviewed Prisma migration history;
3. generate and manually review the migration SQL containing `rateLimit`;
4. apply it only through the guarded staging migration path;
5. run `npm run check:staging:auth-schema` and confirm the `rateLimit` contract;
6. exercise controlled staging authentication traffic and verify HTTP 429 behavior under repeated client requests;
7. only after staging evidence, include the change in a future production release review.

Until steps 1–6 are complete, database-backed rate limiting is **code-complete foundation only**, not a claim that staging or production brute-force protection has been runtime-verified.

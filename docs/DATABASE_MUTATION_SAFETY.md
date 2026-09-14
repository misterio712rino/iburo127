# Database mutation safety

Production-readiness tooling must not expose a generic database mutation command that operates on whichever `DATABASE_URL` happens to be present.

## Removed generic entrypoints

The repository intentionally does not expose these npm aliases:

- `db:migrate` / `prisma migrate dev`;
- generic `db:seed`;
- unguarded demo seed;
- generic `db:studio`.

These commands are easy to point at the wrong database and are not part of the controlled staging activation path.

## Staging identity boundary

Before supported staging DB operations, `DATABASE_URL` must match all of:

```text
IB_DB_TARGET=staging
IB_STAGING_DATABASE_HOST=<exact host>
IB_STAGING_DATABASE_NAME=<exact database>
IB_STAGING_DATABASE_USER=<exact user>
```

The URL identity check is network-free. Supported mutation scripts also verify the connected database identity before applying their mutation where applicable.

## Staging migration

```bash
IB_STAGING_MIGRATION_CONFIRM=MIGRATE:<database> npm run db:deploy:staging
```

This is the only repository migration-deploy entrypoint for the production-readiness staging path. It runs `prisma migrate deploy`, not `prisma migrate dev`.

## Reference seed

Reference roles/plans/features/stages are seeded only with:

```bash
IB_STAGING_REFERENCE_SEED_CONFIRM=REFERENCE-SEED:<database> npm run db:seed:reference:staging
```

`prisma/seed.ts` contains the same staging target and confirmation guards internally, so direct `prisma db seed` without them fails before constructing the Prisma client.

## Demo fixtures

Demo users/cases are staging-only and require a different token:

```bash
IB_STAGING_DEMO_SEED_CONFIRM=DEMO-SEED:<database> npm run db:seed:demo:staging
```

`prisma/seed-demo.ts` also performs the target and confirmation checks internally before constructing the Prisma client.

Demo fixtures must never be treated as real staging E2E evidence unless the exact fixture identities and expected test purpose are documented for that run.

## Production

No command in this runbook authorizes production DDL, production seeding, Prisma Studio against production, Better Auth auto-migration, `prisma db push`, or a production release. Production changes require a separate explicit decision, authoritative target verification, backup/restore evidence, reviewed migration SQL, and production-specific safeguards.

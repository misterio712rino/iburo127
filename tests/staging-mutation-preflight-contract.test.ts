import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { requireReviewedStagingMutationPreflight } from "@/scripts/staging-mutation-preflight";

const preflightSource = await readFile(
  resolve("scripts/staging-mutation-preflight.ts"),
  "utf8",
);
const runtimeIndex = preflightSource.indexOf('env.IB_RUNTIME_TARGET?.trim() !== "staging"');
const inspectIndex = preflightSource.indexOf("await inspectMigrationHistory(");
const targetIndex = preflightSource.indexOf("requireStagingDatabaseTarget(env)");
const confirmationIndex = preflightSource.indexOf(
  "env[options.confirmation.variableName]?.trim()",
);
const schemaVerifyIndex = preflightSource.indexOf("await verifyStagingDatabaseSchema(target)");

assert.ok(runtimeIndex >= 0, "mutation preflight must require global staging runtime identity");
assert.ok(inspectIndex > runtimeIndex, "runtime identity must be verified before migration-history processing");
assert.ok(targetIndex > inspectIndex, "staging target validation must follow migration-history validation");
assert.ok(
  confirmationIndex > targetIndex,
  "operation confirmation must be evaluated after exact target resolution",
);
assert.ok(
  schemaVerifyIndex > confirmationIndex,
  "no PostgreSQL schema verification connection may occur before operation confirmation",
);

await assert.rejects(
  () =>
    requireReviewedStagingMutationPreflight({
      env: {},
      confirmation: {
        variableName: "IB_TEST_CONFIRM",
        expectedValue: () => "TEST",
      },
    }),
  /IB_RUNTIME_TARGET/,
  "missing staging runtime identity must block before migration history or network access",
);
await assert.rejects(
  () =>
    requireReviewedStagingMutationPreflight({
      env: { IB_RUNTIME_TARGET: "production" },
      confirmation: {
        variableName: "IB_TEST_CONFIRM",
        expectedValue: () => "TEST",
      },
    }),
  /IB_RUNTIME_TARGET/,
  "non-staging runtime identity must block before migration history or network access",
);

const root = await mkdtemp(join(tmpdir(), "iburo-staging-mutation-preflight-"));
try {
  const missingMigrations = join(root, "missing");
  await assert.rejects(
    () =>
      requireReviewedStagingMutationPreflight({
        env: { IB_RUNTIME_TARGET: "staging" },
        migrationsDirectory: missingMigrations,
        confirmation: {
          variableName: "IB_TEST_CONFIRM",
          expectedValue: () => "TEST",
        },
      }),
    /authoritative database baseline is unresolved/,
    "missing reviewed migration history must block before target parsing or network access once runtime is staging",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

const entrypoints = [
  {
    path: "prisma/seed.ts",
    mutationMarker: "new PrismaPg",
  },
  {
    path: "prisma/seed-demo.ts",
    mutationMarker: "new PrismaPg",
  },
  {
    path: "scripts/provision-auth-identity.ts",
    mutationMarker: "await provisionAuthIdentity({",
  },
] as const;

for (const entrypoint of entrypoints) {
  const source = await readFile(resolve(entrypoint.path), "utf8");
  const preflightCall = source.indexOf("requireReviewedStagingMutationPreflight({");
  const mutation = source.indexOf(entrypoint.mutationMarker);
  assert.ok(preflightCall >= 0, `${entrypoint.path} must call reviewed staging mutation preflight`);
  assert.ok(mutation > preflightCall, `${entrypoint.path} must preflight before mutation setup/execution`);
}

const migrationEntrypointSource = await readFile(
  resolve("scripts/apply-staging-migrations.ts"),
  "utf8",
);
const migrationRuntimeIndex = migrationEntrypointSource.indexOf(
  'process.env.IB_RUNTIME_TARGET?.trim() !== "staging"',
);
const migrationHistoryIndex = migrationEntrypointSource.indexOf("await inspectMigrationHistory()");
const migrationTargetIndex = migrationEntrypointSource.indexOf("requireStagingDatabaseTarget()");
const migrationPoolIndex = migrationEntrypointSource.indexOf("new Pool({");
const migrationSpawnIndex = migrationEntrypointSource.indexOf("const child = spawn(");
assert.ok(
  migrationRuntimeIndex >= 0,
  "direct staging migration entrypoint must require global staging runtime identity",
);
assert.ok(
  migrationHistoryIndex > migrationRuntimeIndex,
  "staging runtime identity must be checked before migration-history processing",
);
assert.ok(
  migrationTargetIndex > migrationRuntimeIndex,
  "staging runtime identity must be checked before database target resolution",
);
assert.ok(
  migrationPoolIndex > migrationRuntimeIndex,
  "staging runtime identity must be checked before PostgreSQL Pool construction",
);
assert.ok(
  migrationSpawnIndex > migrationPoolIndex,
  "prisma migrate deploy must remain after guarded read-only database identity verification",
);

const authLinkSource = await readFile(
  resolve("scripts/provision-auth-identity.ts"),
  "utf8",
);
assert.match(
  authLinkSource,
  /`LINK:\$\{target\.expectedDatabaseName\}:\$\{userId\}`/,
  "AuthIdentity confirmation must bind both staging database and internal user id",
);

const packageJson = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
) as { scripts?: Record<string, string> };
for (const scriptName of [
  "db:seed:reference:staging",
  "db:seed:demo:staging",
  "auth:link:staging",
]) {
  const script = packageJson.scripts?.[scriptName];
  assert.ok(script, `missing ${scriptName} package script`);
  assert.ok(
    script.startsWith("npm run db:check:migrations &&"),
    `${scriptName} must fail locally on unreviewed migration history before staging access`,
  );
}

const envExample = await readFile(resolve(".env.example"), "utf8");
for (const variableName of [
  "IB_AUTH_LINK_USER_ID",
  "IB_AUTH_LINK_SUBJECT",
  "IB_AUTH_LINK_PROVIDER",
  "IB_AUTH_LINK_CONFIRM",
]) {
  assert.match(
    envExample,
    new RegExp(`^${variableName}=`, "m"),
    `${variableName} must be documented in .env.example`,
  );
}
assert.match(
  envExample,
  /LINK:<staging-database-name>:<IB_AUTH_LINK_USER_ID>/,
  "AuthIdentity confirmation format must be documented",
);

console.log("STAGING_MUTATION_PREFLIGHT_CONTRACT_TEST_PASS");

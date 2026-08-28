import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { requireReviewedStagingMutationPreflight } from "@/scripts/staging-mutation-preflight";

const preflightSource = await readFile(
  resolve("scripts/staging-mutation-preflight.ts"),
  "utf8",
);
const inspectIndex = preflightSource.indexOf("await inspectMigrationHistory(");
const targetIndex = preflightSource.indexOf("requireStagingDatabaseTarget(env)");
const confirmationIndex = preflightSource.indexOf(
  "env[options.confirmation.variableName]?.trim()",
);
const schemaVerifyIndex = preflightSource.indexOf("await verifyStagingDatabaseSchema(target)");

assert.ok(inspectIndex >= 0, "mutation preflight must inspect repository migration history");
assert.ok(targetIndex > inspectIndex, "staging target validation must follow migration-history validation");
assert.ok(
  confirmationIndex > targetIndex,
  "operation confirmation must be evaluated after exact target resolution",
);
assert.ok(
  schemaVerifyIndex > confirmationIndex,
  "no PostgreSQL schema verification connection may occur before operation confirmation",
);

const root = await mkdtemp(join(tmpdir(), "iburo-staging-mutation-preflight-"));
try {
  const missingMigrations = join(root, "missing");
  await assert.rejects(
    () =>
      requireReviewedStagingMutationPreflight({
        env: {},
        migrationsDirectory: missingMigrations,
        confirmation: {
          variableName: "IB_TEST_CONFIRM",
          expectedValue: () => "TEST",
        },
      }),
    /authoritative database baseline is unresolved/,
    "missing reviewed migration history must block before target parsing or network access",
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

const authLinkSource = await readFile(
  resolve("scripts/provision-auth-identity.ts"),
  "utf8",
);
assert.match(
  authLinkSource,
  /`LINK:\$\{target\.expectedDatabaseName\}:\$\{userId\}`/,
  "AuthIdentity confirmation must bind both staging database and internal user id",
);

console.log("STAGING_MUTATION_PREFLIGHT_CONTRACT_TEST_PASS");

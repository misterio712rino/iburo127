import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  requireStagingDatabaseTarget,
  requireStagingMutationConfirmation,
} from "@/scripts/staging-target-guard";
import { requireStagingAuthRuntimeTarget } from "@/scripts/staging-http-target-guard";
import { assertStagingStorageTarget } from "@/scripts/staging-storage-target-guard";
import { buildStagingEnvironmentInventory } from "@/scripts/staging-environment-inventory";

const stagingDatabaseUrl = [
  "postgresql://",
  "iburo_staging_user",
  ":",
  "fixture-value",
  "@",
  "staging.pg.example.net:6432/iburo_staging?sslmode=require",
].join("");

const baseEnv: Record<string, string | undefined> = {
  IB_DB_TARGET: "staging",
  IB_STAGING_DATABASE_NAME: "iburo_staging",
  IB_STAGING_DATABASE_HOST: "staging.pg.example.net",
  IB_STAGING_DATABASE_USER: "iburo_staging_user",
  DATABASE_URL: stagingDatabaseUrl,
};

assert.deepEqual(requireStagingDatabaseTarget(baseEnv), {
  databaseUrl: baseEnv.DATABASE_URL,
  expectedDatabaseName: "iburo_staging",
  expectedHost: "staging.pg.example.net",
  expectedUser: "iburo_staging_user",
});

assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, IB_DB_TARGET: "production" }),
  /IB_DB_TARGET/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL!.replace("iburo_staging?", "iburo_prod?") }),
  /IB_STAGING_DATABASE_NAME/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL!.replace("staging.pg.example.net", "production.pg.example.net") }),
  /IB_STAGING_DATABASE_HOST/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL!.replace("iburo_staging_user:", "prod_user:") }),
  /IB_STAGING_DATABASE_USER/,
);
assert.throws(
  () => requireStagingDatabaseTarget({ ...baseEnv, DATABASE_URL: "https://staging.pg.example.net/iburo_staging" }),
  /postgresql/,
);

assert.equal(
  requireStagingMutationConfirmation(
    { IB_STAGING_REFERENCE_SEED_CONFIRM: "REFERENCE-SEED:iburo_staging" },
    "IB_STAGING_REFERENCE_SEED_CONFIRM",
    "REFERENCE-SEED",
    "iburo_staging",
  ),
  "REFERENCE-SEED:iburo_staging",
);
assert.throws(
  () =>
    requireStagingMutationConfirmation(
      { IB_STAGING_REFERENCE_SEED_CONFIRM: "REFERENCE-SEED:production" },
      "IB_STAGING_REFERENCE_SEED_CONFIRM",
      "REFERENCE-SEED",
      "iburo_staging",
    ),
  /IB_STAGING_REFERENCE_SEED_CONFIRM/,
);

const authEnv: Record<string, string | undefined> = {
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://preview.example.vercel.app",
  BETTER_AUTH_URL: "https://preview.example.vercel.app",
  BETTER_AUTH_SECRET: "s".repeat(32),
};
assert.deepEqual(requireStagingAuthRuntimeTarget(authEnv), {
  baseUrl: "https://preview.example.vercel.app",
  secret: "s".repeat(32),
});
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, IB_RUNTIME_TARGET: "production" }),
  /IB_RUNTIME_TARGET/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, IB_STAGING_BASE_URL: "https://iburo127.ru", BETTER_AUTH_URL: "https://iburo127.ru" }),
  /production hostname/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, BETTER_AUTH_URL: "https://other-preview.example.vercel.app" }),
  /must match IB_STAGING_BASE_URL origin/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, BETTER_AUTH_URL: "https://preview.example.vercel.app/auth" }),
  /must be an origin/,
);
assert.throws(
  () => requireStagingAuthRuntimeTarget({ ...authEnv, BETTER_AUTH_SECRET: "too-short" }),
  /at least 32 characters/,
);

const storageEnv: Record<string, string | undefined> = {
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://preview.example.vercel.app",
  IB_STORAGE_TARGET: "staging",
  YANDEX_STORAGE_BUCKET: "iburo-staging-private",
  IB_STAGING_STORAGE_BUCKET: "iburo-staging-private",
  YANDEX_STORAGE_ACCESS_KEY_ID: "staging-storage-access-key",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "staging-storage-access-key",
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "fixture-storage-secret",
  IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://preview.example.vercel.app",
};
assert.deepEqual(assertStagingStorageTarget(storageEnv), {
  bucket: "iburo-staging-private",
  accessKeyId: "staging-storage-access-key",
  secretAccessKey: "fixture-storage-secret",
  allowedOrigin: "https://preview.example.vercel.app",
});
assert.throws(
  () => assertStagingStorageTarget({ ...storageEnv, IB_RUNTIME_TARGET: "production" }),
  /IB_RUNTIME_TARGET/,
);
assert.throws(
  () => assertStagingStorageTarget({ ...storageEnv, IB_STORAGE_TARGET: "production" }),
  /IB_STORAGE_TARGET/,
);
assert.throws(
  () => assertStagingStorageTarget({ ...storageEnv, IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://other.example.vercel.app" }),
  /must match IB_STAGING_BASE_URL origin/,
);
assert.throws(
  () => assertStagingStorageTarget({
    ...storageEnv,
    IB_STAGING_BASE_URL: "https://iburo127.ru",
    IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://iburo127.ru",
  }),
  /production hostname/,
);
assert.throws(
  () => assertStagingStorageTarget({ ...storageEnv, YANDEX_STORAGE_BUCKET: "production-bucket" }),
  /IB_STAGING_STORAGE_BUCKET/,
);
assert.throws(
  () => assertStagingStorageTarget({ ...storageEnv, YANDEX_STORAGE_ACCESS_KEY_ID: "production-access-key" }),
  /IB_STAGING_STORAGE_ACCESS_KEY_ID/,
);
assert.throws(
  () => assertStagingStorageTarget({
    ...storageEnv,
    YANDEX_STORAGE_ACCESS_KEY_ID: "staging-storage\naccess-key",
    IB_STAGING_STORAGE_ACCESS_KEY_ID: "staging-storage\naccess-key",
  }),
  /YANDEX_STORAGE_ACCESS_KEY_ID/,
);
assert.throws(
  () => assertStagingStorageTarget({
    ...storageEnv,
    YANDEX_STORAGE_SECRET_ACCESS_KEY: "fixture-storage\0secret",
  }),
  /YANDEX_STORAGE_SECRET_ACCESS_KEY/,
);

const storageInventory = buildStagingEnvironmentInventory(storageEnv);
assert.equal(storageInventory.phases.storage.ready, true);
assert.deepEqual(storageInventory.phases.storage.invalidOrInconsistent, []);
const unsafeStorageAccessInventory = buildStagingEnvironmentInventory({
  ...storageEnv,
  YANDEX_STORAGE_ACCESS_KEY_ID: "staging-storage\raccess-key",
  IB_STAGING_STORAGE_ACCESS_KEY_ID: "staging-storage\raccess-key",
});
assert.equal(unsafeStorageAccessInventory.phases.storage.ready, false);
assert.ok(
  unsafeStorageAccessInventory.phases.storage.invalidOrInconsistent.includes(
    "YANDEX_STORAGE_ACCESS_KEY_ID",
  ),
);
assert.ok(
  unsafeStorageAccessInventory.phases.storage.invalidOrInconsistent.includes(
    "IB_STAGING_STORAGE_ACCESS_KEY_ID",
  ),
);
const unsafeStorageSecretInventory = buildStagingEnvironmentInventory({
  ...storageEnv,
  YANDEX_STORAGE_SECRET_ACCESS_KEY: "fixture-storage\nsecret",
});
assert.equal(unsafeStorageSecretInventory.phases.storage.ready, false);
assert.ok(
  unsafeStorageSecretInventory.phases.storage.invalidOrInconsistent.includes(
    "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  ),
);
const mismatchedStorageInventory = buildStagingEnvironmentInventory({
  ...storageEnv,
  IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://other.example.vercel.app",
});
assert.equal(mismatchedStorageInventory.phases.storage.ready, false);
assert.ok(
  mismatchedStorageInventory.phases.storage.invalidOrInconsistent.includes(
    "IB_STAGING_STORAGE_ALLOWED_ORIGIN",
  ),
);
assert.ok(
  mismatchedStorageInventory.phases.storage.invalidOrInconsistent.includes("IB_STAGING_BASE_URL"),
);
const productionStorageInventory = buildStagingEnvironmentInventory({
  ...storageEnv,
  IB_STAGING_BASE_URL: "https://files.iburo127.ru",
  IB_STAGING_STORAGE_ALLOWED_ORIGIN: "https://files.iburo127.ru",
});
assert.equal(productionStorageInventory.phases.storage.ready, false);
assert.ok(
  productionStorageInventory.phases.storage.invalidOrInconsistent.includes("IB_STAGING_BASE_URL"),
);
assert.ok(
  productionStorageInventory.phases.storage.invalidOrInconsistent.includes(
    "IB_STAGING_STORAGE_ALLOWED_ORIGIN",
  ),
);

const coreSource = await readFile(resolve("scripts/check-staging-readiness.ts"), "utf8");
const authGuardIndex = coreSource.indexOf("requireStagingAuthRuntimeTarget()");
const poolIndex = coreSource.indexOf("new Pool(");
const passIndex = coreSource.indexOf("STAGING_CORE_READINESS_PASS");
assert.ok(authGuardIndex >= 0, "staging core must verify auth runtime target identity");
assert.ok(poolIndex > authGuardIndex, "staging auth runtime identity must be verified before database network access");
assert.ok(passIndex > poolIndex, "staging core PASS marker must remain after target validation and DB verification");
assert.match(coreSource, /Better Auth runtime config: staging origin identity verified/);

const storageVerifierSource = await readFile(resolve("scripts/verify-staging-object-storage.ts"), "utf8");
const storageGuardIndex = storageVerifierSource.indexOf("assertStagingStorageTarget()");
const s3ClientIndex = storageVerifierSource.indexOf("new S3Client(");
const storagePassIndex = storageVerifierSource.indexOf("STAGING_OBJECT_STORAGE_VERIFY_PASS");
assert.ok(storageGuardIndex >= 0, "staging storage verifier must assert storage target identity");
assert.ok(s3ClientIndex > storageGuardIndex, "storage target identity must be asserted before S3 network client creation");
assert.ok(storagePassIndex > s3ClientIndex, "storage PASS marker must remain after guarded S3 verification");

const mutationPreflightSource = await readFile(resolve("scripts/staging-mutation-preflight.ts"), "utf8");
const mutationRuntimeGuardIndex = mutationPreflightSource.indexOf('env.IB_RUNTIME_TARGET?.trim() !== "staging"');
const migrationHistoryIndex = mutationPreflightSource.indexOf("inspectMigrationHistory(");
const mutationTargetIndex = mutationPreflightSource.indexOf("requireStagingDatabaseTarget(env)");
const schemaVerifyIndex = mutationPreflightSource.indexOf("verifyStagingDatabaseSchema(target)");
assert.ok(mutationRuntimeGuardIndex >= 0, "staging DB mutation preflight must require global staging runtime");
assert.ok(
  migrationHistoryIndex > mutationRuntimeGuardIndex,
  "global staging runtime must be verified before migration-history processing",
);
assert.ok(
  mutationTargetIndex > mutationRuntimeGuardIndex,
  "global staging runtime must be verified before staging DB target evaluation",
);
assert.ok(
  schemaVerifyIndex > mutationRuntimeGuardIndex,
  "global staging runtime must be verified before staging schema network access",
);

console.log("STAGING_TARGET_GUARD_TEST_PASS");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED_BETTER_AUTH_VERSION = "1.7.2";
const ALLOWED_ROOT_SPECS = new Set([
  EXPECTED_BETTER_AUTH_VERSION,
  `^${EXPECTED_BETTER_AUTH_VERSION}`,
]);

type PackageJson = {
  dependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<
    string,
    {
      version?: string;
      dependencies?: Record<string, string>;
    }
  >;
};

const packageJson = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
) as PackageJson;
const packageLock = JSON.parse(
  await readFile(resolve("package-lock.json"), "utf8"),
) as PackageLock;

const manifestSpec = packageJson.dependencies?.["better-auth"];
assert.ok(
  manifestSpec && ALLOWED_ROOT_SPECS.has(manifestSpec),
  `better-auth manifest spec must remain pinned to the reviewed ${EXPECTED_BETTER_AUTH_VERSION} release line`,
);

const lockRootSpec = packageLock.packages?.[""]?.dependencies?.["better-auth"];
assert.equal(
  lockRootSpec,
  manifestSpec,
  "package-lock root better-auth spec must match package.json",
);

const installedVersion = packageLock.packages?.["node_modules/better-auth"]?.version;
assert.equal(
  installedVersion,
  EXPECTED_BETTER_AUTH_VERSION,
  "package-lock must resolve the exact Better Auth release reviewed by the auth schema/security contracts",
);

console.log("BETTER_AUTH_VERSION_PIN_TEST_PASS");

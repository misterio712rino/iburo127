import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  requireStagingHttpMutationPreflight,
  STAGING_HTTP_MUTATION_PREFLIGHT_FAIL,
} from "@/scripts/staging-http-mutation-preflight";

const clientCookie = "client-cookie-secret";
const baseEnv: NodeJS.ProcessEnv = {
  IB_STAGING_BASE_URL: "https://staging-app.example.com",
  IB_STAGING_MUTATION_TARGET: "staging",
  IB_STAGING_MUTATION_CONFIRM: "MUTATE:staging-app.example.com",
  IB_STAGING_CLIENT_COOKIE: clientCookie,
  IB_STAGING_LAWYER_COOKIE: "lawyer-cookie-secret",
  IB_STAGING_MANAGER_COOKIE: "manager-cookie-secret",
  IB_STAGING_MUTATION_CASE_NUMBER: "STAGE-MUTATION-001",
  IB_STAGING_MUTATION_TASK_ID: "task-1",
  IB_STAGING_FILES_E2E: "0",
  IB_STAGING_FILE_SCAN_E2E: "0",
  IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: "5",
};

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { ...baseEnv, ...overrides };
}

function expectFail(overrides: NodeJS.ProcessEnv, pattern: RegExp) {
  assert.throws(
    () => requireStagingHttpMutationPreflight(env(overrides)),
    (error: unknown) =>
      error instanceof Error &&
      error.message.startsWith(STAGING_HTTP_MUTATION_PREFLIGHT_FAIL) &&
      pattern.test(error.message),
  );
}

const base = requireStagingHttpMutationPreflight(env());
assert.deepEqual(base, {
  baseUrl: "https://staging-app.example.com",
  filesE2e: false,
  fileScanE2e: false,
  fileScanMaxRuns: 5,
});
assert.equal("clientCookie" in base, false);
assert.equal("maintenanceSecret" in base, false);

expectFail({ IB_STAGING_BASE_URL: "://invalid" }, /IB_STAGING_BASE_URL is invalid/);
expectFail({ IB_STAGING_BASE_URL: "http://staging-app.example.com" }, /must use https/);
expectFail({ IB_STAGING_BASE_URL: "https://user:pass@staging-app.example.com" }, /origin without credentials/);
expectFail({ IB_STAGING_BASE_URL: "https://staging-app.example.com/path" }, /origin without credentials/);
expectFail({ IB_STAGING_BASE_URL: "https://staging-app.example.com/?x=1" }, /origin without credentials/);
expectFail({ IB_STAGING_BASE_URL: "https://www.iburo127.ru" }, /production hostname is explicitly blocked/);
expectFail({ IB_STAGING_MUTATION_TARGET: "production" }, /must equal staging/);
expectFail({ IB_STAGING_MUTATION_CONFIRM: "MUTATE:other.example.com" }, /IB_STAGING_MUTATION_CONFIRM/);
expectFail({ IB_STAGING_CLIENT_COOKIE: "" }, /missing IB_STAGING_CLIENT_COOKIE/);
expectFail({ IB_STAGING_LAWYER_COOKIE: "" }, /missing IB_STAGING_LAWYER_COOKIE/);
expectFail({ IB_STAGING_MANAGER_COOKIE: "" }, /missing IB_STAGING_MANAGER_COOKIE/);
expectFail({ IB_STAGING_MUTATION_CASE_NUMBER: "" }, /missing IB_STAGING_MUTATION_CASE_NUMBER/);
expectFail({ IB_STAGING_MUTATION_TASK_ID: "" }, /missing IB_STAGING_MUTATION_TASK_ID/);
expectFail({ IB_STAGING_FILES_E2E: "yes" }, /IB_STAGING_FILES_E2E must equal 0 or 1/);
expectFail({ IB_STAGING_FILE_SCAN_E2E: "true" }, /IB_STAGING_FILE_SCAN_E2E must equal 0 or 1/);
expectFail(
  { IB_STAGING_FILES_E2E: "0", IB_STAGING_FILE_SCAN_E2E: "1" },
  /requires IB_STAGING_FILES_E2E=1/,
);
expectFail({ IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: "0" }, /between 1 and 20/);
expectFail({ IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: "21" }, /between 1 and 20/);

const filesEnv = {
  IB_STAGING_FILES_E2E: "1",
  IB_STAGING_PRIVATE_BUCKET_CONFIRM: "PRIVATE_STAGING_BUCKET:staging-app.example.com",
  IB_STAGING_OTHER_CLIENT_COOKIE: "other-client-cookie-secret",
};
const files = requireStagingHttpMutationPreflight(env(filesEnv));
assert.equal(files.filesE2e, true);
assert.equal(files.fileScanE2e, false);
expectFail(
  { IB_STAGING_FILES_E2E: "1", IB_STAGING_PRIVATE_BUCKET_CONFIRM: "" },
  /missing IB_STAGING_PRIVATE_BUCKET_CONFIRM/,
);
expectFail(
  {
    IB_STAGING_FILES_E2E: "1",
    IB_STAGING_PRIVATE_BUCKET_CONFIRM: "PRIVATE_STAGING_BUCKET:wrong.example.com",
    IB_STAGING_OTHER_CLIENT_COOKIE: "other-client-cookie-secret",
  },
  /IB_STAGING_PRIVATE_BUCKET_CONFIRM/,
);
expectFail(
  {
    ...filesEnv,
    IB_STAGING_OTHER_CLIENT_COOKIE: clientCookie,
  },
  /different CLIENT fixture/,
);

const scanEnv = {
  ...filesEnv,
  IB_STAGING_FILE_SCAN_E2E: "1",
  IB_STAGING_FILE_SCAN_E2E_CONFIRM: "SCAN:staging-app.example.com",
  IB_MAINTENANCE_SECRET: "m".repeat(40),
};
const scan = requireStagingHttpMutationPreflight(env(scanEnv));
assert.equal(scan.filesE2e, true);
assert.equal(scan.fileScanE2e, true);
assert.equal(scan.fileScanMaxRuns, 5);
for (const value of ["1", "20"]) {
  assert.equal(
    requireStagingHttpMutationPreflight(env({ ...scanEnv, IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: value })).fileScanMaxRuns,
    Number(value),
  );
}
expectFail(
  { ...scanEnv, IB_STAGING_FILE_SCAN_E2E_CONFIRM: "" },
  /missing IB_STAGING_FILE_SCAN_E2E_CONFIRM/,
);
expectFail(
  { ...scanEnv, IB_STAGING_FILE_SCAN_E2E_CONFIRM: "SCAN:wrong.example.com" },
  /IB_STAGING_FILE_SCAN_E2E_CONFIRM/,
);
expectFail({ ...scanEnv, IB_MAINTENANCE_SECRET: "short" }, /IB_MAINTENANCE_SECRET/);
expectFail({ ...scanEnv, IB_MAINTENANCE_SECRET: `${"m".repeat(40)}\n` }, /IB_MAINTENANCE_SECRET/);
expectFail({ ...scanEnv, IB_MAINTENANCE_SECRET: `${"m".repeat(20)}\r${"m".repeat(20)}` }, /IB_MAINTENANCE_SECRET/);
expectFail({ ...scanEnv, IB_MAINTENANCE_SECRET: ` ${"m".repeat(40)}` }, /IB_MAINTENANCE_SECRET/);

const loopback = requireStagingHttpMutationPreflight(
  env({
    IB_STAGING_BASE_URL: "http://127.0.0.1:3000",
    IB_STAGING_MUTATION_CONFIRM: "MUTATE:127.0.0.1:3000",
  }),
);
assert.equal(loopback.baseUrl, "http://127.0.0.1:3000");

const source = await readFile(resolve("scripts/staging-http-mutation-preflight.ts"), "utf8");
assert.doesNotMatch(source, /\bfetch\s*\(/);
assert.doesNotMatch(source, /\bPool\b/);
assert.doesNotMatch(source, /\bPrisma\b/);
assert.doesNotMatch(source, /@aws-sdk/);
assert.doesNotMatch(source, /S3Client/);

const cliSource = await readFile(
  resolve("scripts/check-staging-http-mutation-preflight.ts"),
  "utf8",
);
assert.doesNotMatch(cliSource, /IB_STAGING_CLIENT_COOKIE.*console/);
assert.doesNotMatch(cliSource, /IB_MAINTENANCE_SECRET.*console/);
assert.match(cliSource, /STAGING_HTTP_MUTATION_PREFLIGHT_PASS/);

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
assert.equal(
  packageJson.scripts?.["check:staging:http-mutation-preflight"],
  "tsx scripts/check-staging-http-mutation-preflight.ts",
);
for (const scriptName of ["check:staging:http-mutations", "check:staging:http-mutations:audit"]) {
  const script = packageJson.scripts?.[scriptName];
  assert.ok(script, `missing ${scriptName}`);
  assert.ok(
    script.startsWith("npm run check:staging:http-mutation-preflight &&"),
    `${scriptName} must fail network-free before active verifier execution`,
  );
}

console.log("STAGING_HTTP_MUTATION_PREFLIGHT_TEST_PASS");

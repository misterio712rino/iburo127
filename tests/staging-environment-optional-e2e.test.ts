import assert from "node:assert/strict";

import { buildStagingEnvironmentInventory } from "../scripts/staging-environment-inventory";

const baseApplicationE2eEnv = {
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STAGING_AUTH_FLOW_TARGET: "staging",
  IB_STAGING_AUTH_FLOW_CONFIRM: "AUTH-FLOW:stage.iburo.test",
  IB_STAGING_CLIENT_EMAIL: "client@stage.iburo.test",
  IB_STAGING_CLIENT_PASSWORD: "client-password-123",
  IB_STAGING_LAWYER_EMAIL: "lawyer@stage.iburo.test",
  IB_STAGING_LAWYER_PASSWORD: "lawyer-password-123",
  IB_STAGING_LAWYER_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
  IB_STAGING_MANAGER_EMAIL: "manager@stage.iburo.test",
  IB_STAGING_MANAGER_PASSWORD: "manager-password-123",
  IB_STAGING_MANAGER_TOTP_SECRET: "KRSXG5DSNFXGOIDB",
  IB_STAGING_CLIENT_CASE_NUMBER: "STAGE-CLIENT-001",
  IB_STAGING_LAWYER_CASE_NUMBER: "STAGE-LAWYER-001",
  IB_STAGING_CLIENT_AI_CASE_NUMBER: "STAGE-CLIENT-AI-001",
  IB_STAGING_CLIENT_NO_AI_CASE_NUMBER: "STAGE-CLIENT-NOAI-001",
  IB_STAGING_MUTATION_TARGET: "staging",
  IB_STAGING_MUTATION_CONFIRM: "MUTATE:stage.iburo.test",
  IB_STAGING_MUTATION_CASE_NUMBER: "STAGE-MUTATION-001",
  IB_STAGING_MUTATION_TASK_ID: "stage-task-1",
} as const;

function applicationE2e(overrides: Record<string, string | undefined> = {}) {
  return buildStagingEnvironmentInventory({
    ...baseApplicationE2eEnv,
    ...overrides,
  }).phases.applicationE2e;
}

assert.equal(applicationE2e().ready, true, "optional file E2E flags must default to disabled");

for (const [name, value] of [
  ["IB_STAGING_FILES_E2E", "yes"],
  ["IB_STAGING_FILE_SCAN_E2E", "true"],
] as const) {
  const phase = applicationE2e({ [name]: value });
  assert.equal(phase.ready, false);
  assert.ok(phase.invalidOrInconsistent.includes(name));
}

for (const value of ["0", "21", "1.5"]) {
  const phase = applicationE2e({ IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: value });
  assert.equal(phase.ready, false);
  assert.ok(phase.invalidOrInconsistent.includes("IB_STAGING_FILE_SCAN_E2E_MAX_RUNS"));
}
for (const value of ["1", "20"]) {
  assert.equal(
    applicationE2e({ IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: value }).ready,
    true,
    `bounded scan max-runs ${value} must remain valid`,
  );
}

const scanWithoutFiles = applicationE2e({
  IB_STAGING_FILES_E2E: "0",
  IB_STAGING_FILE_SCAN_E2E: "1",
});
assert.equal(scanWithoutFiles.ready, false);
assert.ok(scanWithoutFiles.invalidOrInconsistent.includes("IB_STAGING_FILES_E2E"));
assert.ok(scanWithoutFiles.invalidOrInconsistent.includes("IB_STAGING_FILE_SCAN_E2E"));

const missingFilesDependencies = applicationE2e({ IB_STAGING_FILES_E2E: "1" });
assert.equal(missingFilesDependencies.ready, false);
assert.ok(
  missingFilesDependencies.invalidOrInconsistent.includes("IB_STAGING_PRIVATE_BUCKET_CONFIRM"),
);
assert.ok(
  missingFilesDependencies.invalidOrInconsistent.includes("IB_STAGING_OTHER_CLIENT_COOKIE"),
);

const filesFixture = {
  IB_STAGING_FILES_E2E: "1",
  IB_STAGING_PRIVATE_BUCKET_CONFIRM: "PRIVATE_STAGING_BUCKET:stage.iburo.test",
  IB_STAGING_OTHER_CLIENT_COOKIE: "other-client-cookie-secret",
} as const;
assert.equal(applicationE2e(filesFixture).ready, true);

const missingScanDependencies = applicationE2e({
  ...filesFixture,
  IB_STAGING_FILE_SCAN_E2E: "1",
});
assert.equal(missingScanDependencies.ready, false);
assert.ok(
  missingScanDependencies.invalidOrInconsistent.includes("IB_STAGING_FILE_SCAN_E2E_CONFIRM"),
);
assert.ok(missingScanDependencies.invalidOrInconsistent.includes("IB_MAINTENANCE_SECRET"));

const scanFixture = {
  ...filesFixture,
  IB_STAGING_FILE_SCAN_E2E: "1",
  IB_STAGING_FILE_SCAN_E2E_CONFIRM: "SCAN:stage.iburo.test",
  IB_STAGING_FILE_SCAN_E2E_MAX_RUNS: "5",
  IB_MAINTENANCE_SECRET: "m".repeat(40),
};
assert.equal(applicationE2e(scanFixture).ready, true);

for (const unsafeSecret of [
  "short",
  ` ${"m".repeat(40)}`,
  `${"m".repeat(40)} `,
  `${"m".repeat(20)}\n${"m".repeat(20)}`,
]) {
  const phase = applicationE2e({
    ...scanFixture,
    IB_MAINTENANCE_SECRET: unsafeSecret,
  });
  assert.equal(phase.ready, false);
  assert.ok(phase.invalidOrInconsistent.includes("IB_MAINTENANCE_SECRET"));
}

const wrongConfirmations = applicationE2e({
  ...scanFixture,
  IB_STAGING_PRIVATE_BUCKET_CONFIRM: "PRIVATE_STAGING_BUCKET:wrong.example",
  IB_STAGING_FILE_SCAN_E2E_CONFIRM: "SCAN:wrong.example",
});
assert.equal(wrongConfirmations.ready, false);
assert.ok(
  wrongConfirmations.invalidOrInconsistent.includes("IB_STAGING_PRIVATE_BUCKET_CONFIRM"),
);
assert.ok(
  wrongConfirmations.invalidOrInconsistent.includes("IB_STAGING_FILE_SCAN_E2E_CONFIRM"),
);

const serialized = JSON.stringify(buildStagingEnvironmentInventory(scanFixture));
for (const secret of [scanFixture.IB_STAGING_OTHER_CLIENT_COOKIE, scanFixture.IB_MAINTENANCE_SECRET]) {
  assert.equal(serialized.includes(secret), false, "inventory must not expose optional E2E secrets");
}

const baseMaintenanceEnv = {
  IB_RUNTIME_TARGET: "staging",
  BETTER_AUTH_URL: "https://stage.iburo.test",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_MAINTENANCE_SECRET: "maintenance-secret-that-must-never-print-123456",
  IB_MAINTENANCE_BASE_URL: "https://stage.iburo.test",
} as const;

function maintenance(overrides: Record<string, string | undefined> = {}) {
  return buildStagingEnvironmentInventory({
    ...baseMaintenanceEnv,
    ...overrides,
  }).phases.maintenance;
}

assert.equal(
  maintenance().ready,
  true,
  "optional maintenance timeouts must preserve runtime defaults when absent",
);

for (const timeoutName of [
  "IB_MAINTENANCE_REQUEST_TIMEOUT_MS",
  "IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS",
] as const) {
  for (const invalidValue of ["999", "300001", "1.5", "not-a-number"]) {
    const phase = maintenance({ [timeoutName]: invalidValue });
    assert.equal(phase.ready, false, `${timeoutName}=${invalidValue} must fail inventory readiness`);
    assert.ok(
      phase.invalidOrInconsistent.includes(timeoutName),
      `${timeoutName} must be reported without exposing its value`,
    );
  }
  for (const validValue of ["1000", "300000"]) {
    assert.equal(
      maintenance({ [timeoutName]: validValue }).ready,
      true,
      `${timeoutName}=${validValue} must match runtime bounds`,
    );
  }
}

const maintenanceSerialized = JSON.stringify(buildStagingEnvironmentInventory({
  ...baseMaintenanceEnv,
  IB_MAINTENANCE_REQUEST_TIMEOUT_MS: "15000",
  IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS: "120000",
}));
assert.equal(maintenanceSerialized.includes("15000"), false);
assert.equal(maintenanceSerialized.includes("120000"), false);

console.log("STAGING_ENVIRONMENT_OPTIONAL_E2E_TEST_PASS");

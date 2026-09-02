import "./vercel-staging-identity-route-contract.test";
import "./staging-internal-route-boundary-contract.test";
import "./maintenance-route-security-contract.test";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};

const expected = {
  "maintenance:run:notifications": "node scripts/run-maintenance-job.mjs notification-deliveries",
  "maintenance:run:notification-health": "node scripts/run-maintenance-job.mjs notification-delivery-health",
  "maintenance:run:task-reminders": "node scripts/run-maintenance-job.mjs task-reminders",
  "maintenance:run:questionnaire-reminders": "node scripts/run-maintenance-job.mjs questionnaire-reminders",
  "maintenance:run:stale-uploads": "node scripts/run-maintenance-job.mjs stale-uploads",
  "maintenance:run:stale-upload-health": "node scripts/run-maintenance-job.mjs stale-upload-health",
  "maintenance:run:file-scans": "node scripts/run-maintenance-job.mjs file-scans",
  "maintenance:run:file-scan-health": "node scripts/run-maintenance-job.mjs file-scan-health",
  "maintenance:run:ai-audit-health": "node scripts/run-maintenance-job.mjs ai-audit-health",
} as const;

for (const [name, command] of Object.entries(expected)) {
  assert.equal(scripts[name], command, `${name} must remain wired to the generic maintenance runner`);
}

const runner = await readFile(resolve("scripts/run-maintenance-job.mjs"), "utf8");
const targetGuardIndex = runner.indexOf("assertMaintenanceEnvironmentTarget(env, target)");
const secretIndex = runner.indexOf("const secret = requireSecret(env)");
const fetchIndex = runner.indexOf("await fetchImpl(endpoint");
assert.ok(targetGuardIndex >= 0, "maintenance runner must enforce environment target identity");
assert.ok(secretIndex > targetGuardIndex, "target identity must be verified before the maintenance secret is used");
assert.ok(fetchIndex > secretIndex, "no network request may occur before target and secret validation");
assert.match(runner, /IB_RUNTIME_TARGET must be staging or production/);
assert.match(runner, /IB_MAINTENANCE_BASE_URL must match BETTER_AUTH_URL origin/);
assert.match(runner, /IB_MAINTENANCE_BASE_URL must match IB_STAGING_BASE_URL in staging/);
assert.match(runner, /const expectedConfirmation = `PRODUCTION:\$\{target\.origin\}`/);
assert.match(runner, /IB_MAINTENANCE_PRODUCTION_CONFIRM/);
const productionConfirmationIndex = runner.indexOf("IB_MAINTENANCE_PRODUCTION_CONFIRM");
assert.ok(
  productionConfirmationIndex >= 0 && productionConfirmationIndex < secretIndex,
  "production maintenance confirmation must be validated before the maintenance secret is used",
);

const productionConfig = await readFile(resolve("server/config/production.ts"), "utf8");
assert.match(
  productionConfig,
  /const secret = requireSafeCredential\(env, "IB_MAINTENANCE_SECRET"\)/,
  "production maintenance secret must reject CR/LF/NUL before HTTP authorization use",
);
assert.match(
  productionConfig,
  /if \(secret\.length < 32\).*IB_MAINTENANCE_SECRET/,
  "production maintenance secret must retain its minimum length requirement",
);

const maintenanceRoute = await readFile(
  resolve("app/api/internal/maintenance/file-scans/route.ts"),
  "utf8",
);
const configIndex = maintenanceRoute.indexOf("readMaintenanceRuntimeConfig()");
const authorizationIndex = maintenanceRoute.indexOf("isAuthorizedMaintenanceRequest(request, config.secret)");
const workerIndex = maintenanceRoute.indexOf("getStoredFileScanWorker().runBatch");
assert.ok(configIndex >= 0, "maintenance route must read production maintenance config");
assert.ok(
  authorizationIndex > configIndex,
  "maintenance config validation must occur before maintenance authorization",
);
assert.ok(
  workerIndex > authorizationIndex,
  "maintenance authorization must occur before maintenance worker execution",
);

console.log("MAINTENANCE_PACKAGE_SCRIPT_CONTRACT_PASS");

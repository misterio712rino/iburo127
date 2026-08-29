import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};

const expected = {
  "maintenance:run:task-reminders": "node scripts/run-maintenance-job.mjs task-reminders",
  "maintenance:run:questionnaire-reminders": "node scripts/run-maintenance-job.mjs questionnaire-reminders",
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

console.log("MAINTENANCE_PACKAGE_SCRIPT_CONTRACT_PASS");

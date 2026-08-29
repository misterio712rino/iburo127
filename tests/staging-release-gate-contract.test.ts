import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};
const release = scripts["check:staging:release"] ?? "";
const maintenanceHealth = scripts["check:staging:maintenance-health"] ?? "";

const requiredSteps = [
  "npm run db:check:migrations",
  "npm run check:staging:core",
  "npm run db:verify:staging",
  "npm run check:staging:auth-schema",
  "npm run check:staging:storage",
  "npm run check:staging:file-scanner",
  "npm run check:staging:authz",
  "npm run check:staging:auth-flow",
  "npm run check:staging:application-e2e",
  "npm run check:staging:maintenance-health",
  "npm run check:staging:email-delivery",
  "npm run check:staging:ai-provider",
  "npm run check:staging:bitrix24",
  "npm run check:staging:bitrix24-schema",
] as const;

let previousIndex = -1;
for (const step of requiredSteps) {
  const index = release.indexOf(step);
  assert.ok(index > previousIndex, `${step} must exist in check:staging:release in the required order`);
  previousIndex = index;
}

assert.equal(
  maintenanceHealth,
  "node scripts/run-staging-maintenance-health.mjs",
  "staging maintenance health must use the staging-only orchestration wrapper",
);

const maintenanceWrapper = await readFile(resolve("scripts/run-staging-maintenance-health.mjs"), "utf8");
assert.match(maintenanceWrapper, /IB_RUNTIME_TARGET\?\.trim\(\) !== "staging"/);
const runtimeGuardIndex = maintenanceWrapper.indexOf('IB_RUNTIME_TARGET?.trim() !== "staging"');
const firstRunIndex = maintenanceWrapper.indexOf("runMaintenanceJob({ job, env, fetchImpl })");
assert.ok(runtimeGuardIndex >= 0, "staging maintenance wrapper must require staging runtime identity");
assert.ok(firstRunIndex > runtimeGuardIndex, "staging runtime identity must be checked before any maintenance request");

for (const requiredHealthJob of [
  "notification-delivery-health",
  "stale-upload-health",
  "file-scan-health",
  "ai-audit-health",
]) {
  assert.match(
    maintenanceWrapper,
    new RegExp(`\\"${requiredHealthJob}\\"`),
    `${requiredHealthJob} must remain in staging maintenance health`,
  );
}
for (const mutatingJob of [
  "notification-deliveries",
  "task-reminders",
  "questionnaire-reminders",
  "stale-uploads",
  "file-scans",
]) {
  assert.equal(
    maintenanceWrapper.includes(`"${mutatingJob}"`),
    false,
    `${mutatingJob} must never execute inside staging maintenance health`,
  );
}
assert.match(maintenanceWrapper, /STAGING_MAINTENANCE_HEALTH_PASS/);

const passIndex = release.indexOf("STAGING_RELEASE_READINESS_PASS");
assert.ok(passIndex > previousIndex, "release PASS marker must only be reachable after every required verifier");
assert.doesNotMatch(release, /\|\||;\s*npm run/, "release verifiers must remain fail-closed through && chaining");

console.log("STAGING_RELEASE_GATE_CONTRACT_PASS");

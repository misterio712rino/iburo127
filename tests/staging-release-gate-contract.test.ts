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

async function requireGuardBefore(
  path: string,
  guardMarkers: readonly string[],
  activeMarker: string,
): Promise<void> {
  const source = await readFile(resolve(path), "utf8");
  const activeIndex = source.indexOf(activeMarker);
  assert.ok(activeIndex >= 0, `${path} must contain active operation marker ${activeMarker}`);
  for (const marker of guardMarkers) {
    const guardIndex = source.indexOf(marker);
    assert.ok(guardIndex >= 0, `${path} must contain staging guard ${marker}`);
    assert.ok(
      guardIndex < activeIndex,
      `${path} must execute ${marker} before ${activeMarker}`,
    );
  }
}

const directEntryPoints = {
  "check:staging:core": "tsx scripts/check-staging-readiness.ts",
  "check:staging:auth-schema": "npm run check:staging:target && tsx scripts/verify-staging-better-auth-schema.ts",
  "check:staging:storage": "tsx scripts/verify-staging-object-storage.ts",
  "check:staging:file-scanner": "tsx scripts/verify-staging-file-scanner.ts",
  "check:staging:authz": "tsx scripts/verify-staging-authz-fixtures.ts",
  "check:staging:email-delivery": "tsx scripts/verify-staging-postbox-delivery.ts",
  "check:staging:ai-provider": "tsx scripts/verify-staging-openai.ts",
  "check:staging:bitrix24": "tsx scripts/verify-staging-bitrix24.ts",
  "check:staging:bitrix24-schema": "tsx scripts/verify-staging-bitrix24-schema.ts",
  "check:staging:http-authz": "tsx scripts/verify-staging-http-authz.ts",
  "check:staging:http-ai-authz": "tsx scripts/verify-staging-ai-http-authz.ts",
} as const;
for (const [scriptName, expectedCommand] of Object.entries(directEntryPoints)) {
  assert.equal(
    scripts[scriptName],
    expectedCommand,
    `${scriptName} staging entrypoint changed without boundary review`,
  );
}

await requireGuardBefore(
  "scripts/check-staging-readiness.ts",
  ["requireStagingDatabaseTarget()", "requireStagingAuthRuntimeTarget()"],
  "new Pool(",
);
await requireGuardBefore(
  "scripts/verify-staging-better-auth-schema.ts",
  ["requireStagingDatabaseTarget()"],
  "new Pool(",
);
await requireGuardBefore(
  "scripts/verify-staging-object-storage.ts",
  ["assertStagingStorageTarget()"],
  "new S3Client(",
);
await requireGuardBefore(
  "scripts/verify-staging-file-scanner.ts",
  ["assertStagingFileScannerTarget(process.env)"],
  "new S3Client(",
);
await requireGuardBefore(
  "scripts/verify-staging-authz-fixtures.ts",
  ["requireStagingDatabaseTarget()"],
  "new Pool(",
);
await requireGuardBefore(
  "scripts/verify-staging-postbox-delivery.ts",
  ["assertStagingPostboxTarget(process.env)"],
  "await sendYandexPostboxEmail(",
);
await requireGuardBefore(
  "scripts/verify-staging-openai.ts",
  ["assertStagingAiTarget(process.env)"],
  "new OpenAiResponsesGateway(",
);
await requireGuardBefore(
  "scripts/verify-staging-bitrix24.ts",
  ["assertStagingBitrix24Target(process.env)"],
  "await getBitrix24ProfileIdentity(",
);
await requireGuardBefore(
  "scripts/verify-staging-bitrix24-schema.ts",
  ["assertStagingBitrix24Target(process.env)"],
  "await getBitrix24ItemFields(",
);
await requireGuardBefore(
  "scripts/verify-staging-http-authz.ts",
  ["requireStagingHttpTarget(process.env)"],
  "fetch(",
);
await requireGuardBefore(
  "scripts/verify-staging-ai-http-authz.ts",
  ["requireStagingHttpTarget(process.env)"],
  "fetch(",
);
await requireGuardBefore(
  "scripts/verify-staging-http-mutations.ts",
  ["requireStagingHttpMutationPreflight(process.env)"],
  'await import("./verify-staging-http-mutations-impl")',
);
await requireGuardBefore(
  "scripts/verify-staging-http-mutation-audit.ts",
  ["requireStagingHttpMutationPreflight(process.env)"],
  'await import("./verify-staging-http-mutation-audit-impl")',
);

console.log("STAGING_RELEASE_GATE_CONTRACT_PASS");

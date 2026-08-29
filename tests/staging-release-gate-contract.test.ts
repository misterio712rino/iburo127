import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const release = packageJson.scripts?.["check:staging:release"] ?? "";

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

const passIndex = release.indexOf("STAGING_RELEASE_READINESS_PASS");
assert.ok(passIndex > previousIndex, "release PASS marker must only be reachable after every required verifier");
assert.doesNotMatch(release, /\|\||;\s*npm run/, "release verifiers must remain fail-closed through && chaining");

console.log("STAGING_RELEASE_GATE_CONTRACT_PASS");

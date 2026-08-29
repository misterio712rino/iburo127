import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
) as { scripts?: Record<string, string> };

const activeE2e = packageJson.scripts?.["check:staging:application-e2e"];
assert.equal(
  activeE2e,
  "npm run check:staging:http-authz && npm run check:staging:http-ai-authz && npm run check:staging:http-mutations:audit && node -e \"console.log('STAGING_APPLICATION_E2E_PASS')\"",
  "active staging application E2E must preserve the reviewed authz -> AI entitlement -> guarded mutation/audit order",
);

for (const forbidden of [
  "db:deploy:staging",
  "check:staging:email-delivery",
  "check:staging:ai-provider",
  "check:staging:file-scanner",
  "check:staging:storage",
]) {
  assert.ok(
    !activeE2e.includes(forbidden),
    `active application E2E must not silently execute separately guarded external operation ${forbidden}`,
  );
}

const mutationAudit = packageJson.scripts?.["check:staging:http-mutations:audit"] ?? "";
assert.ok(
  mutationAudit.startsWith("npm run check:staging:http-mutation-preflight &&"),
  "mutation+audit entrypoint must remain protected by the network-free mutation preflight",
);

console.log("STAGING_APPLICATION_E2E_CONTRACT_PASS");

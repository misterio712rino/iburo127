import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluateStagingAuthFlowGuard,
  generateTotp,
  StagingCookieJar,
} from "../scripts/staging-auth-flow-core";

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
assert.equal(generateTotp(rfcSecret, { timestampMs: 59_000, digits: 8 }), "94287082");
assert.equal(generateTotp(rfcSecret, { timestampMs: 59_000, digits: 6 }), "287082");
assert.throws(() => generateTotp("not-base32!"), /INVALID_TOTP_SECRET/);

assert.deepEqual(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "staging",
    authFlowTarget: "staging",
    confirmation: "AUTH-FLOW:stage.iburo.invalid",
    host: "stage.iburo.invalid",
  }),
  { allowed: true, code: "ALLOWED" },
);
assert.equal(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "production",
    authFlowTarget: "staging",
    confirmation: "AUTH-FLOW:stage.iburo.invalid",
    host: "stage.iburo.invalid",
  }).allowed,
  false,
);
assert.equal(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "staging",
    authFlowTarget: "production",
    confirmation: "AUTH-FLOW:stage.iburo.invalid",
    host: "stage.iburo.invalid",
  }).allowed,
  false,
);
assert.equal(
  evaluateStagingAuthFlowGuard({
    runtimeTarget: "staging",
    authFlowTarget: "staging",
    confirmation: "AUTH-FLOW:wrong.invalid",
    host: "stage.iburo.invalid",
  }).allowed,
  false,
);

const jar = new StagingCookieJar();
jar.absorbSetCookieLines([
  "session=alpha==; Path=/; HttpOnly; Secure",
  "two_factor=beta; Path=/; Max-Age=300; HttpOnly",
]);
assert.equal(jar.header(), "session=alpha==; two_factor=beta");
jar.absorbSetCookieLines(["session=; Path=/; Max-Age=0"]);
assert.equal(jar.header(), "two_factor=beta");
jar.clear();
assert.equal(jar.hasCookies, false);

const packageJson = JSON.parse(
  await readFile(resolve("package.json"), "utf8"),
) as { scripts?: Record<string, string> };

assert.equal(
  packageJson.scripts?.["check:staging:auth-flow"],
  "tsx scripts/verify-staging-auth-flow.ts",
  "staging auth flow must have a dedicated entrypoint",
);

const activeE2e = packageJson.scripts?.["check:staging:application-e2e"];
assert.equal(
  activeE2e,
  "npm run check:staging:auth-flow && npm run check:staging:http-authz && npm run check:staging:http-ai-authz && npm run check:staging:http-mutations:audit && node -e \"console.log('STAGING_APPLICATION_E2E_PASS')\"",
  "active staging application E2E must preserve the reviewed fresh-auth -> authz -> AI entitlement -> guarded mutation/audit order",
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

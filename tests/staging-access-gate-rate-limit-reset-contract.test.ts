import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ACCESS_GATE_RATE_LIMIT_KEY_PREFIX,
  accessGateRateLimitDigest,
  readTrustedAccessGateClientIp,
} from "../server/auth/access-gate-rate-limit";

const secret = "s".repeat(32);
const contactKey = "email:client.staging-e2e@example.test";
const contactDigest = accessGateRateLimitDigest("contact", contactKey, secret);
const ipDigest = accessGateRateLimitDigest("ip", "203.0.113.127", secret);

assert.equal(ACCESS_GATE_RATE_LIMIT_KEY_PREFIX, "iburo:access-gate:v1");
assert.match(contactDigest, /^[a-f0-9]{64}$/);
assert.match(ipDigest, /^[a-f0-9]{64}$/);
assert.notEqual(contactDigest, ipDigest, "rate-limit scope must remain part of the HMAC input");
assert.doesNotMatch(contactDigest, /client|example|203\.0\.113/);

assert.equal(
  readTrustedAccessGateClientIp(
    new Request("https://preview.example.test", {
      headers: { "x-forwarded-for": "203.0.113.127, 10.0.0.1" },
    }),
  ),
  "203.0.113.127",
);
assert.throws(
  () => readTrustedAccessGateClientIp(new Request("https://preview.example.test")),
  /ACCESS_GATE_CLIENT_IP_UNAVAILABLE/,
);
assert.throws(
  () =>
    readTrustedAccessGateClientIp(
      new Request("https://preview.example.test", {
        headers: { "x-forwarded-for": "not-an-ip" },
      }),
    ),
  /ACCESS_GATE_CLIENT_IP_UNAVAILABLE/,
);

const accessGateSource = await readFile(resolve("server/auth/access-gate.ts"), "utf8");
const fixtureSource = await readFile(
  resolve("app/%5Fiburo/staging-application-e2e-fixtures/route.ts"),
  "utf8",
);

assert.match(accessGateSource, /accessGateRateLimitDigest\("ip", clientIp, secret\)/);
assert.match(
  accessGateSource,
  /accessGateRateLimitDigest\("contact", identifier\.contactKey, secret\)/,
);
assert.match(accessGateSource, /readTrustedAccessGateClientIp\(request\)/);
assert.doesNotMatch(accessGateSource, /RATE_LIMIT_KEY_PREFIX\s*=/);

const boundaryIndex = fixtureSource.indexOf("if (!isExactStagingPreview(env))");
const confirmationIndex = fixtureSource.indexOf("formData.get(\"confirm\") !== expectedConfirmation");
const keyBuildIndex = fixtureSource.indexOf("buildAccessGateRateLimitKeys(request, sha, env)");
const deleteIndex = fixtureSource.indexOf('delete from "rateLimit" where "key" = ${key}');
assert.ok(boundaryIndex >= 0, "fixture reset must keep the exact staging Preview boundary");
assert.ok(confirmationIndex > boundaryIndex, "commit-bound confirmation must follow the Preview boundary");
assert.ok(keyBuildIndex > confirmationIndex, "limiter keys must not be built before request confirmation");
assert.ok(deleteIndex > keyBuildIndex, "limiter rows must not be mutated before guarded key construction");

for (const email of [
  "client.staging-e2e@example.test",
  "lawyer.demo@example.test",
  "manager.demo@example.test",
]) {
  assert.ok(fixtureSource.includes(email), `fixture reset must pin ${email}`);
}
assert.match(fixtureSource, /staging\.e2e\.\$\{commitSha\.slice\(0, 16\)\}@example\.test/);
assert.match(fixtureSource, /readBetterAuthRuntimeConfig\(env\)/);
assert.match(fixtureSource, /readTrustedAccessGateClientIp\(request\)/);
assert.match(fixtureSource, /for \(const key of accessGateRateLimitKeys\)/);
assert.match(fixtureSource, /delete from "rateLimit" where "key" = \$\{key\}/);
assert.match(fixtureSource, /accessGateRateLimitsDeleted/);
assert.doesNotMatch(
  fixtureSource,
  /delete from "rateLimit"\s*(?:;|`)/i,
  "staging reset must never delete the entire Better Auth rate-limit table",
);
assert.doesNotMatch(
  fixtureSource,
  /rateLimit\.deleteMany\(\s*\{?\s*\}?\s*\)/,
  "staging reset must never use an unbounded Prisma rate-limit delete",
);

console.log("STAGING_ACCESS_GATE_RATE_LIMIT_RESET_CONTRACT_PASS");

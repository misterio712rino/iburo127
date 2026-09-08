import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const authSource = await readFile(
  resolve("server/auth/better-auth-instance.ts"),
  "utf8",
);
const accessGateRateLimitSource = await readFile(
  resolve("server/auth/access-gate.ts"),
  "utf8",
);
const publicContactRateLimitSource = await readFile(
  resolve("server/public-contact/rate-limit.ts"),
  "utf8",
);
const prismaSchema = await readFile(resolve("prisma/schema.prisma"), "utf8");
const stagingVerifier = await readFile(
  resolve("scripts/verify-staging-better-auth-schema.ts"),
  "utf8",
);

assert.match(
  authSource,
  /rateLimit:\s*\{[\s\S]*?enabled:\s*true,[\s\S]*?storage:\s*"database",[\s\S]*?modelName:\s*"rateLimit",[\s\S]*?\}/,
  "Better Auth must use shared database-backed rate-limit state",
);
assert.doesNotMatch(
  authSource,
  /rateLimit:\s*\{[\s\S]*?storage:\s*"memory"/,
  "process-local rate-limit storage must not be reintroduced",
);

assert.match(
  accessGateRateLimitSource,
  /const nowMs = Date\.now\(\);/,
  "access gate throttling must store the shared rateLimit clock in epoch milliseconds",
);
assert.match(
  accessGateRateLimitSource,
  /const windowStartMs = input\.nowMs - RATE_LIMIT_WINDOW_SECONDS \* 1000;/,
  "access gate throttling must convert its seconds-based policy window to milliseconds",
);
assert.doesNotMatch(
  accessGateRateLimitSource,
  /Math\.floor\(Date\.now\(\) \/ 1000\)/,
  "access gate throttling must not write epoch seconds into Better Auth's millisecond rateLimit table",
);

assert.match(
  publicContactRateLimitSource,
  /const nowMs = Date\.now\(\);/,
  "public contact throttling must store the shared rateLimit clock in epoch milliseconds",
);
assert.match(
  publicContactRateLimitSource,
  /const windowStartMs = nowMs - PUBLIC_CONTACT_RATE_LIMIT_WINDOW_SECONDS \* 1000;/,
  "public contact throttling must convert its seconds-based policy window to milliseconds",
);
assert.doesNotMatch(
  publicContactRateLimitSource,
  /Math\.floor\(Date\.now\(\) \/ 1000\)/,
  "public contact throttling must not write epoch seconds into Better Auth's millisecond rateLimit table",
);

for (const providerModel of [
  "AuthRateLimit",
  "BetterAuthUser",
  "BetterAuthSession",
  "BetterAuthAccount",
  "BetterAuthVerification",
  "BetterAuthTwoFactor",
]) {
  assert.doesNotMatch(
    prismaSchema,
    new RegExp(`model\\s+${providerModel}\\b`),
    `${providerModel} must remain outside the legal-domain Prisma schema`,
  );
}

assert.match(
  stagingVerifier,
  /rateLimit:\s*\["id",\s*"key",\s*"count",\s*"lastRequest"\]/,
);
const integerColumns = stagingVerifier.match(
  /const INTEGER_COLUMNS = \[([\s\S]*?)\] as const;/,
)?.[1] ?? "";
assert.match(integerColumns, /\["rateLimit", "count"\]/);
assert.match(integerColumns, /\["rateLimit", "lastRequest"\]/);
assert.match(stagingVerifier, /hasIndex\("rateLimit", \["key"\], true\)/);
assert.match(stagingVerifier, /for \(const tableName of REQUIRED_TABLES\)/);

console.log("AUTH_RATE_LIMIT_STORAGE_TEST_PASS");

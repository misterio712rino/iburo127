import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const authSource = await readFile(
  resolve("server/auth/better-auth-instance.ts"),
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
assert.match(stagingVerifier, /requireType\("rateLimit", "count", INTEGER_TYPES\)/);
assert.match(stagingVerifier, /requireType\("rateLimit", "lastRequest", INTEGER_TYPES\)/);
assert.match(stagingVerifier, /hasUniqueIndex\("rateLimit", \["key"\]\)/);
assert.match(stagingVerifier, /for \(const tableName of REQUIRED_TABLES\)/);

console.log("AUTH_RATE_LIMIT_STORAGE_TEST_PASS");

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

const modelMatch = prismaSchema.match(
  /model AuthRateLimit \{([\s\S]*?)\n\}/,
);
assert.ok(modelMatch, "Prisma schema must model Better Auth rateLimit table");
const rateLimitModel = modelMatch[1] ?? "";
assert.match(rateLimitModel, /\bid\s+String\s+@id\b/);
assert.match(rateLimitModel, /\bkey\s+String\s+@unique\b/);
assert.match(rateLimitModel, /\bcount\s+Int\b/);
assert.match(rateLimitModel, /\blastRequest\s+BigInt\b/);
assert.match(rateLimitModel, /@@map\("rateLimit"\)/);
assert.doesNotMatch(rateLimitModel, /@default\(/);

assert.match(
  stagingVerifier,
  /rateLimit:\s*\["id",\s*"key",\s*"count",\s*"lastRequest"\]/,
);
assert.match(stagingVerifier, /requireType\("rateLimit", "count", INTEGER_TYPES\)/);
assert.match(stagingVerifier, /requireType\("rateLimit", "lastRequest", INTEGER_TYPES\)/);
assert.match(stagingVerifier, /hasUniqueIndex\("rateLimit", \["key"\]\)/);
assert.match(stagingVerifier, /for \(const tableName of REQUIRED_TABLES\)/);

console.log("AUTH_RATE_LIMIT_STORAGE_TEST_PASS");

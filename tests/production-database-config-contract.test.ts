import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  POSTGRES_EXPLICIT_STRICT_SSL_MODE,
  stabilizePostgresSslMode,
} from "../lib/database/postgres-ssl";

const guard = await readFile(resolve("server/database/database-url.ts"), "utf8");
const productionConfig = await readFile(resolve("server/config/production.ts"), "utf8");
const prismaRuntime = await readFile(resolve("server/database/prisma.ts"), "utf8");
const betterAuthRuntime = await readFile(resolve("server/auth/better-auth-instance.ts"), "utf8");
const stagingTargetGuard = await readFile(resolve("scripts/staging-target-guard.ts"), "utf8");

function fixtureDatabaseUrl(sslMode?: string) {
  const base = [
    "postgresql://",
    "user",
    ":",
    "pass",
    "@",
    "db.example.com/app",
  ].join("");
  return sslMode ? `${base}?sslmode=${sslMode}` : base;
}

assert.equal(POSTGRES_EXPLICIT_STRICT_SSL_MODE, "verify-full");
for (const legacyMode of ["prefer", "require", "verify-ca", "REQUIRE"]) {
  const normalized = stabilizePostgresSslMode(
    `${fixtureDatabaseUrl(legacyMode)}&application_name=iburo`,
  );
  const parsed = new URL(normalized);
  assert.equal(parsed.searchParams.get("sslmode"), "verify-full");
  assert.equal(parsed.searchParams.get("application_name"), "iburo");
}
for (const stableMode of ["verify-full", "disable"]) {
  const stableUrl = fixtureDatabaseUrl(stableMode);
  assert.equal(
    stabilizePostgresSslMode(stableUrl),
    stableUrl,
    "non-legacy SSL modes must not be rewritten",
  );
}
const noSslModeUrl = fixtureDatabaseUrl();
assert.equal(stabilizePostgresSslMode(noSslModeUrl), noSslModeUrl);

assert.match(guard, /DATABASE_URL\?\.trim\(\)/);
assert.match(guard, /\[\\r\\n\\0\]/);
assert.match(guard, /new URL\(databaseUrl\)/);
assert.match(guard, /parsed\.protocol !== "postgresql:"/);
assert.match(guard, /parsed\.protocol !== "postgres:"/);
assert.match(guard, /!parsed\.hostname/);
assert.match(guard, /parsed\.pathname === "\/"/);
assert.match(guard, /parsed\.hash/);
assert.match(guard, /stabilizePostgresSslMode\(databaseUrl\)/);

assert.match(productionConfig, /readPostgresDatabaseUrl/);
assert.match(
  productionConfig,
  /return \{ databaseUrl: readPostgresDatabaseUrl\(env\) \};/,
);
assert.doesNotMatch(
  productionConfig,
  /databaseUrl: requireEnv\(env, "DATABASE_URL"\)/,
);

assert.match(prismaRuntime, /readPostgresDatabaseUrl/);
assert.match(prismaRuntime, /const databaseUrl = readPostgresDatabaseUrl\(\)/);
assert.doesNotMatch(prismaRuntime, /process\.env\.DATABASE_URL/);
assert.ok(
  prismaRuntime.indexOf("readPostgresDatabaseUrl()") < prismaRuntime.indexOf("new PrismaPg("),
  "database URL guard must run before PrismaPg adapter construction",
);

assert.match(betterAuthRuntime, /const database = readProductionDatabaseConfig\(\)/);
assert.ok(
  betterAuthRuntime.indexOf("readProductionDatabaseConfig()") <
    betterAuthRuntime.indexOf("new Pool({ connectionString: database.databaseUrl })"),
  "validated production database config must be read before Better Auth pg.Pool construction",
);
assert.doesNotMatch(betterAuthRuntime, /process\.env\.DATABASE_URL/);

assert.match(stagingTargetGuard, /stabilizePostgresSslMode/);
assert.match(
  stagingTargetGuard,
  /databaseUrl:\s*stabilizePostgresSslMode\(databaseUrl\)/,
  "staging DB consumers must preserve pg@8 strict TLS semantics without rewriting staging env",
);

console.log("PRODUCTION_DATABASE_CONFIG_CONTRACT_PASS");

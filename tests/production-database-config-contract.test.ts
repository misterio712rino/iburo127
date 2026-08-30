import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const guard = await readFile(resolve("server/database/database-url.ts"), "utf8");
const productionConfig = await readFile(resolve("server/config/production.ts"), "utf8");
const prismaRuntime = await readFile(resolve("server/database/prisma.ts"), "utf8");
const betterAuthRuntime = await readFile(resolve("server/auth/better-auth-instance.ts"), "utf8");

assert.match(guard, /DATABASE_URL\?\.trim\(\)/);
assert.match(guard, /\[\\r\\n\\0\]/);
assert.match(guard, /new URL\(databaseUrl\)/);
assert.match(guard, /parsed\.protocol !== "postgresql:"/);
assert.match(guard, /parsed\.protocol !== "postgres:"/);
assert.match(guard, /!parsed\.hostname/);
assert.match(guard, /parsed\.pathname === "\/"/);
assert.match(guard, /parsed\.hash/);

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

console.log("PRODUCTION_DATABASE_CONFIG_CONTRACT_PASS");

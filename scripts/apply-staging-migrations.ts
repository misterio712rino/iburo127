import "dotenv/config";

import { spawn } from "node:child_process";
import { Pool } from "pg";

function fail(message: string): never {
  console.error(`STAGING_MIGRATION_FAIL: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedDatabaseName = process.env.IB_STAGING_DATABASE_NAME?.trim();
const target = process.env.IB_DB_TARGET?.trim();

if (!databaseUrl) fail("missing DATABASE_URL");
if (!expectedDatabaseName) fail("missing IB_STAGING_DATABASE_NAME");
if (target !== "staging") fail('IB_DB_TARGET must be exactly "staging"');

const expectedConfirmation = `MIGRATE:${expectedDatabaseName}`;
if (process.env.IB_STAGING_MIGRATION_CONFIRM !== expectedConfirmation) {
  fail(`IB_STAGING_MIGRATION_CONFIRM must be exactly ${expectedConfirmation}`);
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

try {
  const result = await pool.query<{
    database_name: string;
    database_user: string;
  }>("select current_database() as database_name, current_user as database_user");

  const row = result.rows[0];
  if (!row) fail("database identity query returned no rows");
  if (row.database_name !== expectedDatabaseName) {
    fail(
      `connected database ${row.database_name} does not match IB_STAGING_DATABASE_NAME ${expectedDatabaseName}`,
    );
  }

  console.log(`Staging migration target verified: database=${row.database_name}, user=${row.database_user}`);
} finally {
  await pool.end();
}

console.log("Running reviewed Prisma migrations with `prisma migrate deploy`...");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

const exitCode = await new Promise<number>((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) {
  fail(`prisma migrate deploy exited with code ${exitCode}`);
}

console.log("STAGING_MIGRATION_PASS");

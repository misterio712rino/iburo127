import "dotenv/config";

import { spawn } from "node:child_process";
import { Pool } from "pg";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`STAGING_MIGRATION_FAIL: ${message}`);
  process.exit(1);
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const expectedConfirmation = `MIGRATE:${target.expectedDatabaseName}`;
if (process.env.IB_STAGING_MIGRATION_CONFIRM !== expectedConfirmation) {
  fail(`IB_STAGING_MIGRATION_CONFIRM must be exactly ${expectedConfirmation}`);
}

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");
  const result = await client.query<{ database_name: string }>(
    "select current_database() as database_name",
  );
  if (result.rows[0]?.database_name !== target.expectedDatabaseName) {
    fail("connected database does not match the preflight staging database identity");
  }
  console.log(`Staging migration target verified: ${target.expectedDatabaseName}`);
  await client.query("ROLLBACK");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
  throw error;
} finally {
  client.release();
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

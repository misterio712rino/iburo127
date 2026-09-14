import "dotenv/config";

import { spawn } from "node:child_process";
import { Pool } from "pg";
import {
  assertPinnedMigrationHistory,
  inspectMigrationHistory,
} from "./migration-history-guard";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`STAGING_MIGRATION_FAIL: ${message}`);
  process.exit(1);
}

if (process.env.IB_RUNTIME_TARGET?.trim() !== "staging") {
  fail('IB_RUNTIME_TARGET must be exactly "staging" for staging migrations');
}

// Fail before any database connection unless a reviewed migration history exists
// and its exact fingerprint is pinned for this staging operation.
let migrationHistory;
try {
  migrationHistory = await inspectMigrationHistory();
  assertPinnedMigrationHistory(
    migrationHistory,
    process.env.IB_STAGING_MIGRATION_HISTORY_SHA256,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid or unpinned migration history");
}
console.log(
  `Reviewed migration history verified: count=${migrationHistory.migrationCount} sha256=${migrationHistory.fingerprint}`,
);

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

// Node.js on Windows can reject direct spawning of .cmd shims with EINVAL.
// Use cmd.exe explicitly there; the command is a fixed literal with no user input.
const prismaLauncher =
  process.platform === "win32"
    ? {
        command: process.env.ComSpec?.trim() || "cmd.exe",
        args: ["/d", "/s", "/c", "npx prisma migrate deploy"],
      }
    : {
        command: "npx",
        args: ["prisma", "migrate", "deploy"],
      };

const child = spawn(prismaLauncher.command, prismaLauncher.args, {
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

const exitCode = await new Promise<number>((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) {
  fail(`prisma migrate deploy exited with code ${exitCode}`);
}

console.log("STAGING_MIGRATION_PASS");

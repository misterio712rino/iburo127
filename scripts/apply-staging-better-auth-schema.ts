import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

const BETTER_AUTH_SCHEMA = "public";
const REQUIRED_TABLES = ["user", "session", "account", "verification", "twoFactor", "rateLimit"] as const;
const SQL_PATH = resolve("database/better-auth/1.7.2/schema.sql");
const ADVISORY_LOCK_KEY = "iburo127:staging:better-auth:1.7.2";

function fail(message: string): never {
  console.error(`STAGING_BETTER_AUTH_MIGRATION_FAIL: ${message}`);
  process.exit(1);
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

if (process.env.IB_RUNTIME_TARGET?.trim() !== "staging") {
  fail('IB_RUNTIME_TARGET must be exactly "staging" for Better Auth staging migration');
}

const configuredSchema = process.env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim();
if (configuredSchema !== BETTER_AUTH_SCHEMA) {
  fail(`IB_STAGING_BETTER_AUTH_SCHEMA must be exactly ${BETTER_AUTH_SCHEMA}`);
}

const sql = await readFile(SQL_PATH, "utf8");
if (!sql.trim()) fail("reviewed Better Auth SQL is empty");
const sqlSha256 = createHash("sha256").update(sql).digest("hex");
const expectedSqlSha256 = process.env.IB_STAGING_BETTER_AUTH_SQL_SHA256?.trim().toLowerCase();
if (!expectedSqlSha256) fail("missing IB_STAGING_BETTER_AUTH_SQL_SHA256");
if (!/^[a-f0-9]{64}$/.test(expectedSqlSha256)) {
  fail("IB_STAGING_BETTER_AUTH_SQL_SHA256 must be a lowercase SHA-256 hex digest");
}
if (sqlSha256 !== expectedSqlSha256) {
  fail("Better Auth SQL fingerprint does not match the reviewed staging fingerprint");
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const expectedConfirmation = `BETTER_AUTH:${target.expectedDatabaseName}:${BETTER_AUTH_SCHEMA}`;
if (process.env.IB_STAGING_BETTER_AUTH_MIGRATION_CONFIRM !== expectedConfirmation) {
  fail(`IB_STAGING_BETTER_AUTH_MIGRATION_CONFIRM must be exactly ${expectedConfirmation}`);
}

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  max: 1,
});

const client = await pool.connect();
let transactionOpen = false;
try {
  await client.query("BEGIN");
  transactionOpen = true;

  await client.query("select pg_advisory_xact_lock(hashtext($1))", [ADVISORY_LOCK_KEY]);

  const identity = await client.query<{ database_name: string; current_schema: string | null }>(
    "select current_database() as database_name, current_schema() as current_schema",
  );
  const identityRow = identity.rows[0];
  requireCondition(
    identityRow && identityRow.database_name === target.expectedDatabaseName,
    "connected database does not match the preflight staging database identity",
  );
  requireCondition(
    identityRow.current_schema === BETTER_AUTH_SCHEMA,
    `current schema must be ${BETTER_AUTH_SCHEMA}`,
  );

  const existing = await client.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = $1
        and table_name = any($2::text[])
      order by table_name
    `,
    [BETTER_AUTH_SCHEMA, REQUIRED_TABLES],
  );
  requireCondition(
    existing.rows.length === 0,
    `Better Auth schema is not clean; existing tables: ${existing.rows.map((row) => row.table_name).join(", ")}`,
  );

  console.log(`Reviewed Better Auth SQL verified: sha256=${sqlSha256}`);
  console.log(`Staging Better Auth target verified: ${target.expectedDatabaseName}.${BETTER_AUTH_SCHEMA}`);
  console.log("Transactional advisory lock acquired");

  await client.query(sql);

  const created = await client.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = $1
        and table_name = any($2::text[])
      order by table_name
    `,
    [BETTER_AUTH_SCHEMA, REQUIRED_TABLES],
  );
  requireCondition(
    created.rows.length === REQUIRED_TABLES.length,
    `Better Auth migration created ${created.rows.length}/${REQUIRED_TABLES.length} required tables`,
  );

  await client.query("COMMIT");
  transactionOpen = false;
  console.log("STAGING_BETTER_AUTH_MIGRATION_PASS");
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
  }
  fail(error instanceof Error ? error.message : "Better Auth staging migration failed");
} finally {
  client.release();
  await pool.end();
}

import "dotenv/config";

import { Pool } from "pg";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`STAGING_READINESS_FAIL: ${message}`);
  process.exit(1);
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
const authUrlValue = process.env.BETTER_AUTH_URL?.trim();
if (!authSecret) fail("missing BETTER_AUTH_SECRET");
if (!authUrlValue) fail("missing BETTER_AUTH_URL");
if (authSecret.length < 32) fail("BETTER_AUTH_SECRET must be at least 32 characters");

let authUrl: URL;
try {
  authUrl = new URL(authUrlValue);
} catch {
  fail("BETTER_AUTH_URL must be an absolute URL");
}
if (authUrl.protocol !== "https:" && authUrl.hostname !== "localhost") {
  fail("BETTER_AUTH_URL must use HTTPS outside localhost");
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
  const databaseName = result.rows[0]?.database_name;
  if (!databaseName) fail("PostgreSQL identity query returned no rows");
  if (databaseName !== target.expectedDatabaseName) {
    fail("connected database does not match the preflight staging database identity");
  }
  console.log(`Staging PostgreSQL identity verified: ${target.expectedDatabaseName}`);
  console.log("Better Auth runtime config: present and structurally valid");
  console.log("STAGING_CORE_READINESS_PASS");
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

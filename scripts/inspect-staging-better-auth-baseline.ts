import "dotenv/config";

import { Pool } from "pg";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

const BETTER_AUTH_SCHEMA = "public";
const REQUIRED_TABLES = ["user", "session", "account", "verification", "twoFactor", "rateLimit"] as const;

function fail(message: string): never {
  console.error(`STAGING_BETTER_AUTH_BASELINE_FAIL: ${message}`);
  process.exit(1);
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const configuredSchema = process.env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim();
if (configuredSchema !== BETTER_AUTH_SCHEMA) {
  fail(`IB_STAGING_BETTER_AUTH_SCHEMA must be exactly ${BETTER_AUTH_SCHEMA}`);
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

  const identity = await client.query<{ database_name: string; current_schema: string | null }>(
    "select current_database() as database_name, current_schema() as current_schema",
  );
  const identityRow = identity.rows[0];
  if (!identityRow || identityRow.database_name !== target.expectedDatabaseName) {
    throw new Error("connected database does not match the preflight staging database identity");
  }
  if (identityRow.current_schema !== BETTER_AUTH_SCHEMA) {
    throw new Error(`current schema must be ${BETTER_AUTH_SCHEMA}`);
  }

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

  const present = existing.rows.map((row) => row.table_name);
  console.log(`Staging database identity verified: ${identityRow.database_name}`);
  console.log(`Better Auth schema verified: ${BETTER_AUTH_SCHEMA}`);
  console.log(`Better Auth tables present: ${present.length}/${REQUIRED_TABLES.length}`);
  if (present.length > 0) {
    console.log(`Better Auth tables found: ${present.join(", ")}`);
  }

  if (present.length === 0) {
    console.log("STAGING_BETTER_AUTH_BASELINE_CLEAN");
  } else if (present.length === REQUIRED_TABLES.length) {
    console.log("STAGING_BETTER_AUTH_BASELINE_COMPLETE");
  } else {
    throw new Error(`partial Better Auth schema detected: ${present.length}/${REQUIRED_TABLES.length}`);
  }

  await client.query("ROLLBACK");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original failure.
  }
  fail(error instanceof Error ? error.message : "Better Auth baseline inspection failed");
} finally {
  client.release();
  await pool.end();
}

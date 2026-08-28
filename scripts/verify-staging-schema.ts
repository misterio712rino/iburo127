import "dotenv/config";

import { Pool } from "pg";

function fail(message: string): never {
  console.error(`STAGING_SCHEMA_VERIFY_FAIL: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedDatabaseName = process.env.IB_STAGING_DATABASE_NAME?.trim();
const target = process.env.IB_DB_TARGET?.trim();

if (!databaseUrl) fail("missing DATABASE_URL");
if (!expectedDatabaseName) fail("missing IB_STAGING_DATABASE_NAME");
if (target !== "staging") fail('IB_DB_TARGET must be exactly "staging"');

const REQUIRED_TABLES = [
  "User",
  "Role",
  "UserRole",
  "AuthIdentity",
  "Plan",
  "Feature",
  "PlanFeature",
  "CaseStage",
  "ClientCase",
  "CaseQuestionnaire",
  "CasePracticumProgress",
  "CaseTask",
  "TaskStatusEvent",
  "CaseDocument",
  "CaseActivityEvent",
  "Notification",
  "NotificationDelivery",
  "StoredFile",
] as const;

const REQUIRED_ENUMS = [
  "UserStatus",
  "ClientCaseStatus",
  "QuestionnaireStatus",
  "PracticumProgressStatus",
  "TaskStatus",
  "CaseDocumentStatus",
  "StoredFileStatus",
  "NotificationDeliveryChannel",
  "NotificationDeliveryStatus",
] as const;

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");

  const identity = await client.query<{ database_name: string }>(
    "select current_database() as database_name",
  );
  const databaseName = identity.rows[0]?.database_name;
  if (!databaseName) fail("database identity query returned no rows");
  if (databaseName !== expectedDatabaseName) {
    fail(
      `connected database ${databaseName} does not match IB_STAGING_DATABASE_NAME ${expectedDatabaseName}`,
    );
  }

  const tableResult = await client.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    `,
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));
  if (missingTables.length > 0) {
    fail(`missing required domain tables: ${missingTables.join(", ")}`);
  }

  const enumResult = await client.query<{ type_name: string }>(
    `
      select t.typname as type_name
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typtype = 'e'
    `,
  );
  const existingEnums = new Set(enumResult.rows.map((row) => row.type_name));
  const missingEnums = REQUIRED_ENUMS.filter((enumName) => !existingEnums.has(enumName));
  if (missingEnums.length > 0) {
    fail(`missing required domain enums: ${missingEnums.join(", ")}`);
  }

  if (existingTables.has("_prisma_migrations")) {
    const migrationResult = await client.query<{ unfinished_count: string }>(
      `
        select count(*)::text as unfinished_count
        from "_prisma_migrations"
        where finished_at is null
          and rolled_back_at is null
      `,
    );
    const unfinishedCount = Number(migrationResult.rows[0]?.unfinished_count ?? "0");
    if (!Number.isFinite(unfinishedCount)) fail("could not evaluate Prisma migration state");
    if (unfinishedCount > 0) {
      fail(`Prisma migration history contains ${unfinishedCount} unfinished migration(s)`);
    }
  } else {
    console.warn("STAGING_SCHEMA_VERIFY_WARN: _prisma_migrations table not found; migration history baseline still requires review");
  }

  console.log(`Staging database identity verified: ${databaseName}`);
  console.log(`Required domain tables verified: ${REQUIRED_TABLES.length}`);
  console.log(`Required PostgreSQL enums verified: ${REQUIRED_ENUMS.length}`);
  console.log("STAGING_SCHEMA_VERIFY_PASS");

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

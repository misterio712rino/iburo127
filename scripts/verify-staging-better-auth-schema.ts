import "dotenv/config";

import { createHash } from "node:crypto";
import { Pool } from "pg";

const REQUIRED_COLUMNS = {
  user: [
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "createdAt",
    "updatedAt",
    "twoFactorEnabled",
  ],
  session: [
    "id",
    "userId",
    "token",
    "expiresAt",
    "ipAddress",
    "userAgent",
    "createdAt",
    "updatedAt",
  ],
  account: [
    "id",
    "userId",
    "issuer",
    "accountId",
    "providerId",
    "accessToken",
    "refreshToken",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "scope",
    "idToken",
    "password",
    "createdAt",
    "updatedAt",
  ],
  verification: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
  twoFactor: [
    "id",
    "userId",
    "secret",
    "backupCodes",
    "verified",
    "failedVerificationCount",
    "lockedUntil",
  ],
  rateLimit: ["id", "key", "count", "lastRequest"],
} as const;

const REQUIRED_TABLES = Object.keys(REQUIRED_COLUMNS);
const STRING_TYPES = new Set(["text", "character varying", "character", "uuid"]);
const TIMESTAMP_TYPES = new Set(["timestamp with time zone", "timestamp without time zone"]);
const INTEGER_TYPES = new Set(["smallint", "integer", "bigint", "numeric"]);
const BOOLEAN_TYPES = new Set(["boolean"]);

const STRING_COLUMNS = [
  ["user", "id"],
  ["user", "name"],
  ["user", "email"],
  ["user", "image"],
  ["session", "id"],
  ["session", "userId"],
  ["session", "token"],
  ["session", "ipAddress"],
  ["session", "userAgent"],
  ["account", "id"],
  ["account", "userId"],
  ["account", "issuer"],
  ["account", "accountId"],
  ["account", "providerId"],
  ["account", "accessToken"],
  ["account", "refreshToken"],
  ["account", "scope"],
  ["account", "idToken"],
  ["account", "password"],
  ["verification", "id"],
  ["verification", "identifier"],
  ["verification", "value"],
  ["twoFactor", "id"],
  ["twoFactor", "userId"],
  ["twoFactor", "secret"],
  ["twoFactor", "backupCodes"],
  ["rateLimit", "id"],
  ["rateLimit", "key"],
] as const;

const TIMESTAMP_COLUMNS = [
  ["user", "createdAt"],
  ["user", "updatedAt"],
  ["session", "expiresAt"],
  ["session", "createdAt"],
  ["session", "updatedAt"],
  ["account", "accessTokenExpiresAt"],
  ["account", "refreshTokenExpiresAt"],
  ["account", "createdAt"],
  ["account", "updatedAt"],
  ["verification", "expiresAt"],
  ["verification", "createdAt"],
  ["verification", "updatedAt"],
  ["twoFactor", "lockedUntil"],
] as const;

const BOOLEAN_COLUMNS = [
  ["user", "emailVerified"],
  ["user", "twoFactorEnabled"],
  ["twoFactor", "verified"],
] as const;

const INTEGER_COLUMNS = [
  ["twoFactor", "failedVerificationCount"],
  ["rateLimit", "count"],
  ["rateLimit", "lastRequest"],
] as const;

function fail(message: string): never {
  console.error(`STAGING_BETTER_AUTH_SCHEMA_VERIFY_FAIL: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const expectedDatabaseName = process.env.IB_STAGING_DATABASE_NAME?.trim();
const expectedSchema = process.env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim();
const target = process.env.IB_DB_TARGET?.trim();

if (!databaseUrl) fail("missing DATABASE_URL");
if (!expectedDatabaseName) fail("missing IB_STAGING_DATABASE_NAME");
if (!expectedSchema) fail("missing IB_STAGING_BETTER_AUTH_SCHEMA");
if (target !== "staging") fail('IB_DB_TARGET must be exactly "staging"');

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  max: 1,
});

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");

  const identity = await client.query<{
    database_name: string;
    current_schema: string | null;
    search_path: string;
  }>(
    `
      select
        current_database() as database_name,
        current_schema() as current_schema,
        current_setting('search_path') as search_path
    `,
  );
  const identityRow = identity.rows[0];
  if (!identityRow) fail("database identity query returned no rows");
  if (identityRow.database_name !== expectedDatabaseName) {
    fail(
      `connected database ${identityRow.database_name} does not match IB_STAGING_DATABASE_NAME ${expectedDatabaseName}`,
    );
  }
  if (identityRow.current_schema !== expectedSchema) {
    fail(
      `current schema ${identityRow.current_schema ?? "<none>"} does not match IB_STAGING_BETTER_AUTH_SCHEMA ${expectedSchema}`,
    );
  }

  const columnResult = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
  }>(
    `
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = $1
        and table_name = any($2::text[])
      order by table_name, ordinal_position
    `,
    [expectedSchema, REQUIRED_TABLES],
  );

  const columnsByTable = new Map<string, Map<string, { dataType: string; nullable: boolean }>>();
  for (const row of columnResult.rows) {
    const table = columnsByTable.get(row.table_name) ?? new Map();
    table.set(row.column_name, {
      dataType: row.data_type,
      nullable: row.is_nullable === "YES",
    });
    columnsByTable.set(row.table_name, table);
  }

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const table = columnsByTable.get(tableName);
    if (!table) fail(`missing Better Auth table ${expectedSchema}.${tableName}`);
    const missingColumns = requiredColumns.filter((columnName) => !table.has(columnName));
    if (missingColumns.length > 0) {
      fail(`missing columns on ${tableName}: ${missingColumns.join(", ")}`);
    }
  }

  function requireType(tableName: string, columnName: string, allowed: ReadonlySet<string>) {
    const column = columnsByTable.get(tableName)?.get(columnName);
    if (!column) fail(`missing ${tableName}.${columnName}`);
    if (!allowed.has(column.dataType)) {
      fail(`${tableName}.${columnName} has unexpected type ${column.dataType}`);
    }
  }

  for (const [tableName, columnName] of STRING_COLUMNS) {
    requireType(tableName, columnName, STRING_TYPES);
  }
  for (const [tableName, columnName] of TIMESTAMP_COLUMNS) {
    requireType(tableName, columnName, TIMESTAMP_TYPES);
  }
  for (const [tableName, columnName] of BOOLEAN_COLUMNS) {
    requireType(tableName, columnName, BOOLEAN_TYPES);
  }
  for (const [tableName, columnName] of INTEGER_COLUMNS) {
    requireType(tableName, columnName, INTEGER_TYPES);
  }

  const indexResult = await client.query<{
    table_name: string;
    index_name: string;
    is_unique: boolean;
    columns: string[];
  }>(
    `
      select
        table_rel.relname as table_name,
        index_rel.relname as index_name,
        idx.indisunique as is_unique,
        array_agg(attr.attname order by key_cols.ordinality) as columns
      from pg_index idx
      join pg_class table_rel on table_rel.oid = idx.indrelid
      join pg_namespace ns on ns.oid = table_rel.relnamespace
      join pg_class index_rel on index_rel.oid = idx.indexrelid
      join lateral unnest(idx.indkey) with ordinality as key_cols(attnum, ordinality) on true
      join pg_attribute attr
        on attr.attrelid = table_rel.oid
       and attr.attnum = key_cols.attnum
      where ns.nspname = $1
        and table_rel.relname = any($2::text[])
      group by table_rel.relname, index_rel.relname, idx.indisunique
      order by table_rel.relname, index_rel.relname
    `,
    [expectedSchema, REQUIRED_TABLES],
  );

  function hasUniqueIndex(tableName: string, columns: readonly string[]) {
    return indexResult.rows.some(
      (row) =>
        row.table_name === tableName &&
        row.is_unique &&
        row.columns.length === columns.length &&
        row.columns.every((column, index) => column === columns[index]),
    );
  }

  if (!hasUniqueIndex("user", ["email"])) fail("user.email unique index/constraint is missing");
  if (!hasUniqueIndex("session", ["token"])) fail("session.token unique index/constraint is missing");
  if (!hasUniqueIndex("account", ["issuer", "accountId"])) {
    fail("account unique index on (issuer, accountId) is missing");
  }
  if (!hasUniqueIndex("rateLimit", ["key"])) {
    fail("rateLimit.key unique index/constraint is missing");
  }

  const primaryKeyResult = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    `
      select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_catalog = tc.constraint_catalog
       and kcu.constraint_schema = tc.constraint_schema
       and kcu.constraint_name = tc.constraint_name
      where tc.table_schema = $1
        and tc.constraint_type = 'PRIMARY KEY'
        and tc.table_name = any($2::text[])
      order by tc.table_name, kcu.ordinal_position
    `,
    [expectedSchema, REQUIRED_TABLES],
  );
  const primaryKeys = new Map(primaryKeyResult.rows.map((row) => [row.table_name, row.column_name]));
  for (const tableName of REQUIRED_TABLES) {
    if (primaryKeys.get(tableName) !== "id") fail(`${tableName}.id primary key is missing`);
  }

  const foreignKeyResult = await client.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(
    `
      select
        tc.table_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_catalog = tc.constraint_catalog
       and kcu.constraint_schema = tc.constraint_schema
       and kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_catalog = tc.constraint_catalog
       and ccu.constraint_schema = tc.constraint_schema
       and ccu.constraint_name = tc.constraint_name
      where tc.table_schema = $1
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.table_name = any($2::text[])
      order by tc.table_name, kcu.ordinal_position
    `,
    [expectedSchema, REQUIRED_TABLES],
  );

  function hasUserForeignKey(tableName: string) {
    return foreignKeyResult.rows.some(
      (row) =>
        row.table_name === tableName &&
        row.column_name === "userId" &&
        row.foreign_table_name === "user" &&
        row.foreign_column_name === "id",
    );
  }

  for (const tableName of ["session", "account", "twoFactor"] as const) {
    if (!hasUserForeignKey(tableName)) fail(`${tableName}.userId -> user.id foreign key is missing`);
  }

  const fingerprintPayload = {
    databaseName: identityRow.database_name,
    schema: expectedSchema,
    searchPath: identityRow.search_path,
    columns: columnResult.rows,
    indexes: indexResult.rows,
    primaryKeys: primaryKeyResult.rows,
    foreignKeys: foreignKeyResult.rows,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(fingerprintPayload))
    .digest("hex");

  console.log(`Staging database identity verified: ${identityRow.database_name}`);
  console.log(`Better Auth schema/search_path verified: ${expectedSchema}`);
  console.log(`Better Auth 1.7 core + 2FA + rate-limit tables verified: ${REQUIRED_TABLES.length}`);
  console.log("Better Auth required columns, types, unique indexes and user foreign keys verified");
  console.log(`Better Auth structural SHA-256: ${fingerprint}`);
  console.log("STAGING_BETTER_AUTH_SCHEMA_VERIFY_PASS");

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

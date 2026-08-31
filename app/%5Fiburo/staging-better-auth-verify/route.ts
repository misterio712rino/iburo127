import { createHash } from "node:crypto";

import { Pool } from "pg";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BETTER_AUTH_SCHEMA = "public";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const REQUIRED_COLUMNS = {
  user: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "twoFactorEnabled"],
  session: ["id", "userId", "token", "expiresAt", "ipAddress", "userAgent", "createdAt", "updatedAt"],
  account: ["id", "userId", "issuer", "accountId", "providerId", "accessToken", "refreshToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "idToken", "password", "createdAt", "updatedAt"],
  verification: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
  twoFactor: ["id", "userId", "secret", "backupCodes", "verified", "failedVerificationCount", "lockedUntil"],
  rateLimit: ["id", "key", "count", "lastRequest"],
} as const;
const REQUIRED_TABLES = Object.keys(REQUIRED_COLUMNS);
const NULLABLE_COLUMNS = new Set<string>([
  "user.image",
  "user.twoFactorEnabled",
  "session.ipAddress",
  "session.userAgent",
  "account.accessToken",
  "account.refreshToken",
  "account.accessTokenExpiresAt",
  "account.refreshTokenExpiresAt",
  "account.scope",
  "account.idToken",
  "account.password",
  "twoFactor.verified",
  "twoFactor.failedVerificationCount",
  "twoFactor.lockedUntil",
]);
const STRING_TYPES = new Set(["text", "character varying", "character", "uuid"]);
const TIMESTAMP_TYPES = new Set(["timestamp with time zone", "timestamp without time zone"]);
const INTEGER_TYPES = new Set(["smallint", "integer", "bigint", "numeric"]);
const BOOLEAN_TYPES = new Set(["boolean"]);
const STRING_COLUMNS = [
  ["user", "id"], ["user", "name"], ["user", "email"], ["user", "image"],
  ["session", "id"], ["session", "userId"], ["session", "token"], ["session", "ipAddress"], ["session", "userAgent"],
  ["account", "id"], ["account", "userId"], ["account", "issuer"], ["account", "accountId"], ["account", "providerId"], ["account", "accessToken"], ["account", "refreshToken"], ["account", "scope"], ["account", "idToken"], ["account", "password"],
  ["verification", "id"], ["verification", "identifier"], ["verification", "value"],
  ["twoFactor", "id"], ["twoFactor", "userId"], ["twoFactor", "secret"], ["twoFactor", "backupCodes"],
  ["rateLimit", "id"], ["rateLimit", "key"],
] as const;
const TIMESTAMP_COLUMNS = [
  ["user", "createdAt"], ["user", "updatedAt"],
  ["session", "expiresAt"], ["session", "createdAt"], ["session", "updatedAt"],
  ["account", "accessTokenExpiresAt"], ["account", "refreshTokenExpiresAt"], ["account", "createdAt"], ["account", "updatedAt"],
  ["verification", "expiresAt"], ["verification", "createdAt"], ["verification", "updatedAt"],
  ["twoFactor", "lockedUntil"],
] as const;
const BOOLEAN_COLUMNS = [["user", "emailVerified"], ["user", "twoFactorEnabled"], ["twoFactor", "verified"]] as const;
const INTEGER_COLUMNS = [["twoFactor", "failedVerificationCount"], ["rateLimit", "count"], ["rateLimit", "lastRequest"]] as const;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

type FailureStage = "preview-boundary" | "target" | "configuration" | "connect" | "begin" | "identity" | "columns" | "types" | "indexes" | "primary-keys" | "foreign-keys";

function exactPreviewCommitSha(env: NodeJS.ProcessEnv): string | null {
  const value = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return value && EXACT_GIT_SHA_PATTERN.test(value) ? value.toLowerCase() : null;
}

function isExactStagingPreview(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    exactPreviewCommitSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

function fail(stage: FailureStage, status = 503) {
  return Response.json(
    { service: "iburo127", probe: "staging-better-auth-verify", pass: false, failureStage: stage },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) return fail("preview-boundary", 404);
  if (env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() !== BETTER_AUTH_SCHEMA) return fail("configuration");

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return fail("target");
  }

  const pool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    max: 1,
  });
  let client: Awaited<ReturnType<typeof pool.connect>> | null = null;
  let transactionOpen = false;
  let failureStage: FailureStage = "connect";

  try {
    client = await pool.connect();
    failureStage = "begin";
    await client.query("BEGIN READ ONLY");
    transactionOpen = true;

    failureStage = "identity";
    const identity = await client.query<{ database_name: string; current_schema: string | null; search_path: string }>(
      "select current_database() as database_name, current_schema() as current_schema, current_setting('search_path') as search_path",
    );
    const identityRow = identity.rows[0];
    if (!identityRow || identityRow.database_name !== target.expectedDatabaseName || identityRow.current_schema !== BETTER_AUTH_SCHEMA) throw new Error("identity mismatch");

    failureStage = "columns";
    const columnResult = await client.query<{ table_name: string; column_name: string; data_type: string; is_nullable: "YES" | "NO" }>(
      `select table_name, column_name, data_type, is_nullable
       from information_schema.columns
       where table_schema = $1 and table_name = any($2::text[])
       order by table_name, ordinal_position`,
      [BETTER_AUTH_SCHEMA, REQUIRED_TABLES],
    );
    const columnsByTable = new Map<string, Map<string, { dataType: string; nullable: boolean }>>();
    for (const row of columnResult.rows) {
      const table = columnsByTable.get(row.table_name) ?? new Map<string, { dataType: string; nullable: boolean }>();
      table.set(row.column_name, { dataType: row.data_type, nullable: row.is_nullable === "YES" });
      columnsByTable.set(row.table_name, table);
    }
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      const table = columnsByTable.get(tableName);
      if (!table) throw new Error("missing table");
      for (const columnName of requiredColumns) {
        const column = table.get(columnName);
        if (!column) throw new Error("missing column");
        if (column.nullable !== NULLABLE_COLUMNS.has(`${tableName}.${columnName}`)) throw new Error("nullability mismatch");
      }
    }

    failureStage = "types";
    const requireType = (tableName: string, columnName: string, allowed: ReadonlySet<string>) => {
      const column = columnsByTable.get(tableName)?.get(columnName);
      if (!column || !allowed.has(column.dataType)) throw new Error("type mismatch");
    };
    for (const [tableName, columnName] of STRING_COLUMNS) requireType(tableName, columnName, STRING_TYPES);
    for (const [tableName, columnName] of TIMESTAMP_COLUMNS) requireType(tableName, columnName, TIMESTAMP_TYPES);
    for (const [tableName, columnName] of BOOLEAN_COLUMNS) requireType(tableName, columnName, BOOLEAN_TYPES);
    for (const [tableName, columnName] of INTEGER_COLUMNS) requireType(tableName, columnName, INTEGER_TYPES);

    failureStage = "indexes";
    const indexResult = await client.query<{ table_name: string; index_name: string; is_unique: boolean; columns: string[] }>(
      `select table_rel.relname as table_name, index_rel.relname as index_name, idx.indisunique as is_unique,
              array_agg(attr.attname order by key_cols.ordinality) as columns
       from pg_index idx
       join pg_class table_rel on table_rel.oid = idx.indrelid
       join pg_namespace ns on ns.oid = table_rel.relnamespace
       join pg_class index_rel on index_rel.oid = idx.indexrelid
       join lateral unnest(idx.indkey) with ordinality as key_cols(attnum, ordinality) on true
       join pg_attribute attr on attr.attrelid = table_rel.oid and attr.attnum = key_cols.attnum
       where ns.nspname = $1 and table_rel.relname = any($2::text[])
       group by table_rel.relname, index_rel.relname, idx.indisunique
       order by table_rel.relname, index_rel.relname`,
      [BETTER_AUTH_SCHEMA, REQUIRED_TABLES],
    );
    const hasIndex = (tableName: string, columns: readonly string[], isUnique: boolean) => indexResult.rows.some(
      (row) => row.table_name === tableName && row.is_unique === isUnique && row.columns.length === columns.length && row.columns.every((column, index) => column === columns[index]),
    );
    for (const [tableName, columns] of [
      ["user", ["email"]], ["session", ["token"]], ["account", ["issuer", "accountId"]], ["rateLimit", ["key"]],
    ] as const) if (!hasIndex(tableName, columns, true)) throw new Error("unique index missing");
    for (const [tableName, columns] of [
      ["session", ["userId"]], ["account", ["userId"]], ["verification", ["identifier"]], ["twoFactor", ["secret"]], ["twoFactor", ["userId"]],
    ] as const) if (!hasIndex(tableName, columns, false)) throw new Error("supporting index missing");

    failureStage = "primary-keys";
    const primaryKeyResult = await client.query<{ table_name: string; column_name: string }>(
      `select tc.table_name, kcu.column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_catalog = tc.constraint_catalog and kcu.constraint_schema = tc.constraint_schema and kcu.constraint_name = tc.constraint_name
       where tc.table_schema = $1 and tc.constraint_type = 'PRIMARY KEY' and tc.table_name = any($2::text[])
       order by tc.table_name, kcu.ordinal_position`,
      [BETTER_AUTH_SCHEMA, REQUIRED_TABLES],
    );
    const primaryKeys = new Map(primaryKeyResult.rows.map((row) => [row.table_name, row.column_name]));
    for (const tableName of REQUIRED_TABLES) if (primaryKeys.get(tableName) !== "id") throw new Error("primary key missing");

    failureStage = "foreign-keys";
    const foreignKeyResult = await client.query<{ table_name: string; column_name: string; foreign_table_name: string; foreign_column_name: string; delete_rule: string }>(
      `select tc.table_name, kcu.column_name, ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name, rc.delete_rule
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_catalog = tc.constraint_catalog and kcu.constraint_schema = tc.constraint_schema and kcu.constraint_name = tc.constraint_name
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_catalog = tc.constraint_catalog and ccu.constraint_schema = tc.constraint_schema and ccu.constraint_name = tc.constraint_name
       join information_schema.referential_constraints rc
         on rc.constraint_catalog = tc.constraint_catalog and rc.constraint_schema = tc.constraint_schema and rc.constraint_name = tc.constraint_name
       where tc.table_schema = $1 and tc.constraint_type = 'FOREIGN KEY' and tc.table_name = any($2::text[])
       order by tc.table_name, kcu.ordinal_position`,
      [BETTER_AUTH_SCHEMA, REQUIRED_TABLES],
    );
    for (const tableName of ["session", "account", "twoFactor"] as const) {
      const pass = foreignKeyResult.rows.some((row) => row.table_name === tableName && row.column_name === "userId" && row.foreign_table_name === "user" && row.foreign_column_name === "id" && row.delete_rule === "CASCADE");
      if (!pass) throw new Error("foreign key missing");
    }

    const fingerprint = createHash("sha256").update(JSON.stringify({
      databaseName: identityRow.database_name,
      schema: BETTER_AUTH_SCHEMA,
      searchPath: identityRow.search_path,
      columns: columnResult.rows,
      indexes: indexResult.rows,
      primaryKeys: primaryKeyResult.rows,
      foreignKeys: foreignKeyResult.rows,
    })).digest("hex");

    await client.query("ROLLBACK");
    transactionOpen = false;
    return Response.json({
      service: "iburo127",
      probe: "staging-better-auth-verify",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: exactPreviewCommitSha(env),
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: BETTER_AUTH_SCHEMA,
      tables: REQUIRED_TABLES.length,
      uniqueIndexes: 4,
      supportingIndexes: 5,
      primaryKeys: REQUIRED_TABLES.length,
      cascadingUserForeignKeys: 3,
      structuralSha256: fingerprint,
      readOnly: true,
      pass: true,
    }, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    if (transactionOpen && client) {
      try { await client.query("ROLLBACK"); } catch { /* preserve bounded stage */ }
    }
    return fail(failureStage);
  } finally {
    client?.release();
    await pool.end();
  }
}

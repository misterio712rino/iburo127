import "dotenv/config";

import { createHash } from "node:crypto";
import { Pool } from "pg";
import { requireStagingDatabaseTarget } from "./staging-target-guard";

function fail(message: string): never {
  console.error(`DATABASE_BASELINE_FAIL: ${message}`);
  process.exit(1);
}

let target: ReturnType<typeof requireStagingDatabaseTarget>;
try {
  target = requireStagingDatabaseTarget();
} catch (error) {
  fail(error instanceof Error ? error.message : "invalid staging database target");
}

const pool = new Pool({
  connectionString: target.databaseUrl,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
  max: 1,
});

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");

    const identityResult = await client.query<{
      database_name: string;
      database_user: string;
      server_version: string;
      server_version_num: string;
      current_schema: string | null;
    }>(`
      select
        current_database() as database_name,
        current_user as database_user,
        current_setting('server_version') as server_version,
        current_setting('server_version_num') as server_version_num,
        current_schema() as current_schema
    `);

    const databaseIdentity = identityResult.rows[0];
    if (!databaseIdentity) fail("database identity query returned no rows");
    if (databaseIdentity.database_name !== target.expectedDatabaseName) {
      fail(
        `connected database ${databaseIdentity.database_name} does not match IB_STAGING_DATABASE_NAME ${target.expectedDatabaseName}`,
      );
    }
    if (databaseIdentity.database_user !== target.expectedUser) {
      fail(
        `connected database user ${databaseIdentity.database_user} does not match IB_STAGING_DATABASE_USER ${target.expectedUser}`,
      );
    }

    const schemasResult = await client.query<{ schema_name: string }>(`
      select schema_name
      from information_schema.schemata
      where schema_name not in ('pg_catalog', 'information_schema')
        and schema_name not like 'pg_toast%'
        and schema_name not like 'pg_temp_%'
      order by schema_name
    `);

    const tablesResult = await client.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(`
      select table_schema, table_name, table_type
      from information_schema.tables
      where table_schema not in ('pg_catalog', 'information_schema')
        and table_schema not like 'pg_toast%'
        and table_schema not like 'pg_temp_%'
      order by table_schema, table_name
    `);

    const columnsResult = await client.query<{
      table_schema: string;
      table_name: string;
      ordinal_position: number;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: "YES" | "NO";
      column_default: string | null;
    }>(`
      select
        table_schema,
        table_name,
        ordinal_position,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema not in ('pg_catalog', 'information_schema')
        and table_schema not like 'pg_toast%'
        and table_schema not like 'pg_temp_%'
      order by table_schema, table_name, ordinal_position
    `);

    const enumsResult = await client.query<{
      schema_name: string;
      enum_name: string;
      enum_value: string;
      sort_order: number;
    }>(`
      select
        ns.nspname as schema_name,
        typ.typname as enum_name,
        enum.enumlabel as enum_value,
        enum.enumsortorder as sort_order
      from pg_type typ
      join pg_enum enum on enum.enumtypid = typ.oid
      join pg_namespace ns on ns.oid = typ.typnamespace
      where ns.nspname not in ('pg_catalog', 'information_schema')
      order by ns.nspname, typ.typname, enum.enumsortorder
    `);

    const indexesResult = await client.query<{
      schema_name: string;
      table_name: string;
      index_name: string;
      index_definition: string;
    }>(`
      select
        schemaname as schema_name,
        tablename as table_name,
        indexname as index_name,
        indexdef as index_definition
      from pg_indexes
      where schemaname not in ('pg_catalog', 'information_schema')
        and schemaname not like 'pg_toast%'
        and schemaname not like 'pg_temp_%'
      order by schemaname, tablename, indexname
    `);

    const constraintsResult = await client.query<{
      schema_name: string;
      table_name: string;
      constraint_name: string;
      constraint_type: string;
      definition: string;
    }>(`
      select
        ns.nspname as schema_name,
        rel.relname as table_name,
        con.conname as constraint_name,
        con.contype::text as constraint_type,
        pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname not in ('pg_catalog', 'information_schema')
        and ns.nspname not like 'pg_toast%'
        and ns.nspname not like 'pg_temp_%'
      order by ns.nspname, rel.relname, con.conname
    `);

    const prismaMigrationTableResult = await client.query<{ exists: boolean }>(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = '_prisma_migrations'
      ) as exists
    `);

    let prismaMigrationCount: number | null = null;
    if (prismaMigrationTableResult.rows[0]?.exists) {
      const migrationCountResult = await client.query<{ count: string }>(
        'select count(*)::text as count from public."_prisma_migrations"',
      );
      const parsedMigrationCount = Number(migrationCountResult.rows[0]?.count ?? "NaN");
      if (!Number.isSafeInteger(parsedMigrationCount) || parsedMigrationCount < 0) {
        fail("could not evaluate Prisma migration count");
      }
      prismaMigrationCount = parsedMigrationCount;
    }

    const structuralSnapshot = {
      schemas: schemasResult.rows,
      tables: tablesResult.rows,
      columns: columnsResult.rows,
      enums: enumsResult.rows,
      indexes: indexesResult.rows,
      constraints: constraintsResult.rows,
    };

    const structuralFingerprint = createHash("sha256")
      .update(JSON.stringify(structuralSnapshot))
      .digest("hex");

    const output = {
      inspectedAt: new Date().toISOString(),
      database: databaseIdentity,
      prismaMigrations: {
        tableExists: prismaMigrationTableResult.rows[0]?.exists ?? false,
        rowCount: prismaMigrationCount,
      },
      counts: {
        schemas: schemasResult.rowCount ?? 0,
        tables: tablesResult.rowCount ?? 0,
        columns: columnsResult.rowCount ?? 0,
        enums: enumsResult.rowCount ?? 0,
        indexes: indexesResult.rowCount ?? 0,
        constraints: constraintsResult.rowCount ?? 0,
      },
      structuralFingerprint,
      structure: structuralSnapshot,
    };

    console.log(JSON.stringify(output, null, 2));
    await client.query("ROLLBACK");
    console.error(`DATABASE_BASELINE_PASS: sha256=${structuralFingerprint}`);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

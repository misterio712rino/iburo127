import {
  assertPinnedMigrationHistory,
  inspectMigrationHistory,
  type MigrationHistorySnapshot,
} from "@/scripts/migration-history-guard";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";

export type CommercePostgresIntegrationTarget = {
  mode: "github-actions-isolated" | "staging";
  expectedDatabaseName: string;
  expectedUser: string;
  migrationHistory: MigrationHistorySnapshot;
};

export async function requireCommercePostgresIntegrationTarget(
  confirmationAction: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<CommercePostgresIntegrationTarget> {
  const migrationHistory = await inspectMigrationHistory();
  const mode = env.IB_COMMERCE_POSTGRES_TEST_TARGET?.trim();

  if (mode === "github-actions-isolated") {
    if (env.CI?.trim() !== "true" || env.GITHUB_ACTIONS?.trim() !== "true") {
      throw new Error("isolated PostgreSQL test target is restricted to GitHub Actions");
    }
    if (env.NODE_ENV?.trim() !== "test") {
      throw new Error('NODE_ENV must be exactly "test" for the isolated PostgreSQL test target');
    }

    let databaseUrl: URL;
    try {
      databaseUrl = new URL(env.DATABASE_URL ?? "");
    } catch {
      throw new Error("DATABASE_URL is not a valid isolated PostgreSQL URL");
    }
    const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
    const databaseUser = decodeURIComponent(databaseUrl.username);
    if (
      !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
      databaseUrl.hostname !== "127.0.0.1" ||
      databaseUrl.port !== "5432" ||
      databaseName !== "iburo_commerce" ||
      databaseUser !== "postgres" ||
      databaseUrl.password !== "" ||
      databaseUrl.searchParams.get("schema") !== "public"
    ) {
      throw new Error("DATABASE_URL does not match the isolated GitHub Actions PostgreSQL service");
    }

    return {
      mode: "github-actions-isolated",
      expectedDatabaseName: "iburo_commerce",
      expectedUser: "postgres",
      migrationHistory,
    };
  }

  if (mode) {
    throw new Error("IB_COMMERCE_POSTGRES_TEST_TARGET has an unsupported value");
  }

  if (env.IB_RUNTIME_TARGET?.trim() !== "staging") {
    throw new Error('IB_RUNTIME_TARGET must be exactly "staging"');
  }
  if (env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() !== "public") {
    throw new Error('IB_STAGING_BETTER_AUTH_SCHEMA must be exactly "public"');
  }
  const stagingTarget = requireStagingDatabaseTarget(env);
  assertPinnedMigrationHistory(migrationHistory, env.IB_STAGING_MIGRATION_HISTORY_SHA256);
  if (
    env.IB_STAGING_TEST_CONFIRM?.trim() !==
    `${confirmationAction}:${stagingTarget.expectedDatabaseName}`
  ) {
    throw new Error("IB_STAGING_TEST_CONFIRM does not authorize this staging test target");
  }

  return {
    mode: "staging",
    expectedDatabaseName: stagingTarget.expectedDatabaseName,
    expectedUser: stagingTarget.expectedUser,
    migrationHistory,
  };
}

export function assertIsolatedCiMigrationHistory(
  expected: MigrationHistorySnapshot,
  actual: ReadonlyArray<{
    migrationName: string;
    finishedAt: Date | string | null;
    rolledBackAt: Date | string | null;
  }>,
): void {
  const unfinished = actual.filter((row) => row.finishedAt === null && row.rolledBackAt === null);
  if (unfinished.length > 0) {
    throw new Error("isolated PostgreSQL contains unfinished migrations");
  }
  const applied = actual
    .filter((row) => row.finishedAt !== null && row.rolledBackAt === null)
    .map((row) => row.migrationName)
    .sort();
  const expectedNames = expected.migrations.map((migration) => migration.name).sort();
  if (JSON.stringify(applied) !== JSON.stringify(expectedNames)) {
    throw new Error("isolated PostgreSQL applied migrations do not match the repository history");
  }
}

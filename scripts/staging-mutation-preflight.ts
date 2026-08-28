import { resolve } from "node:path";
import {
  assertPinnedMigrationHistory,
  inspectMigrationHistory,
  type MigrationHistorySnapshot,
} from "./migration-history-guard";
import {
  requireStagingDatabaseTarget,
  type Environment,
  type StagingDatabaseTarget,
} from "./staging-target-guard";
import {
  verifyStagingDatabaseSchema,
  type StagingSchemaVerificationReport,
} from "./staging-schema-verifier";

export type StagingMutationConfirmation = {
  variableName: string;
  expectedValue: (target: StagingDatabaseTarget) => string;
};

export type StagingMutationPreflightOptions = {
  env?: Environment;
  confirmation: StagingMutationConfirmation;
  migrationsDirectory?: string;
};

export type StagingMutationPreflightResult = {
  target: StagingDatabaseTarget;
  migrationHistory: MigrationHistorySnapshot;
  schema: StagingSchemaVerificationReport;
};

export async function requireReviewedStagingMutationPreflight(
  options: StagingMutationPreflightOptions,
): Promise<StagingMutationPreflightResult> {
  const env = options.env ?? process.env;
  const migrationHistory = await inspectMigrationHistory(
    options.migrationsDirectory ?? resolve("prisma/migrations"),
  );
  assertPinnedMigrationHistory(
    migrationHistory,
    env.IB_STAGING_MIGRATION_HISTORY_SHA256,
  );

  const target = requireStagingDatabaseTarget(env);
  const expectedConfirmation = options.confirmation.expectedValue(target);
  if (env[options.confirmation.variableName]?.trim() !== expectedConfirmation) {
    throw new Error(
      `${options.confirmation.variableName} must be exactly ${expectedConfirmation}`,
    );
  }

  const schema = await verifyStagingDatabaseSchema(target);
  return {
    target,
    migrationHistory,
    schema,
  };
}

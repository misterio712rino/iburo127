import { REQUIRED_STAGING_DOMAIN_TABLES, REQUIRED_STAGING_ENUMS } from "./staging-schema-contract";

export const REQUIRED_BETTER_AUTH_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "twoFactor",
  "rateLimit",
] as const;

export type StagingBaselineStrategy =
  | "A_EMPTY_DATABASE"
  | "B_EXISTING_DOMAIN_SCHEMA"
  | "C_PRISMA_HISTORY_PRESENT"
  | "D_AUTH_SCHEMA_ONLY"
  | "REVIEW_NONEMPTY_OTHER_SCHEMA";

export type StagingBaselineSummaryInput = {
  totalUserTableCount: number;
  domainTableCount: number;
  domainEnumCount: number;
  betterAuthTableCount: number;
  prismaMigrationHistory: {
    tablePresent: boolean;
    appliedCount: number;
    unfinishedCount: number;
  };
};

export type StagingBaselineClassification = {
  strategy: StagingBaselineStrategy;
  domainSchemaPresent: boolean;
  domainSchemaComplete: boolean;
  betterAuthSchemaPresent: boolean;
  betterAuthSchemaComplete: boolean;
  prismaHistoryPresent: boolean;
  requiresFullStructuralReview: boolean;
};

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

export function classifyStagingBaseline(
  input: StagingBaselineSummaryInput,
): StagingBaselineClassification {
  requireNonNegativeInteger(input.totalUserTableCount, "totalUserTableCount");
  requireNonNegativeInteger(input.domainTableCount, "domainTableCount");
  requireNonNegativeInteger(input.domainEnumCount, "domainEnumCount");
  requireNonNegativeInteger(input.betterAuthTableCount, "betterAuthTableCount");
  requireNonNegativeInteger(
    input.prismaMigrationHistory.appliedCount,
    "prismaMigrationHistory.appliedCount",
  );
  requireNonNegativeInteger(
    input.prismaMigrationHistory.unfinishedCount,
    "prismaMigrationHistory.unfinishedCount",
  );

  if (input.domainTableCount > REQUIRED_STAGING_DOMAIN_TABLES.length) {
    throw new Error("domainTableCount exceeds required domain table count");
  }
  if (input.domainEnumCount > REQUIRED_STAGING_ENUMS.length) {
    throw new Error("domainEnumCount exceeds required domain enum count");
  }
  if (input.betterAuthTableCount > REQUIRED_BETTER_AUTH_TABLES.length) {
    throw new Error("betterAuthTableCount exceeds required Better Auth table count");
  }

  const knownTableCount =
    input.domainTableCount +
    input.betterAuthTableCount +
    (input.prismaMigrationHistory.tablePresent ? 1 : 0);
  if (knownTableCount > input.totalUserTableCount) {
    throw new Error("known table count exceeds total user table count");
  }

  const domainSchemaPresent = input.domainTableCount > 0 || input.domainEnumCount > 0;
  const domainSchemaComplete =
    input.domainTableCount === REQUIRED_STAGING_DOMAIN_TABLES.length &&
    input.domainEnumCount === REQUIRED_STAGING_ENUMS.length;
  const betterAuthSchemaPresent = input.betterAuthTableCount > 0;
  const betterAuthSchemaComplete =
    input.betterAuthTableCount === REQUIRED_BETTER_AUTH_TABLES.length;
  const prismaHistoryPresent = input.prismaMigrationHistory.tablePresent;
  const unknownTableCount = input.totalUserTableCount - knownTableCount;

  let strategy: StagingBaselineStrategy;
  if (prismaHistoryPresent) {
    strategy = "C_PRISMA_HISTORY_PRESENT";
  } else if (domainSchemaPresent) {
    strategy = "B_EXISTING_DOMAIN_SCHEMA";
  } else if (input.totalUserTableCount === 0) {
    strategy = "A_EMPTY_DATABASE";
  } else if (betterAuthSchemaPresent && unknownTableCount === 0) {
    strategy = "D_AUTH_SCHEMA_ONLY";
  } else {
    strategy = "REVIEW_NONEMPTY_OTHER_SCHEMA";
  }

  return {
    strategy,
    domainSchemaPresent,
    domainSchemaComplete,
    betterAuthSchemaPresent,
    betterAuthSchemaComplete,
    prismaHistoryPresent,
    requiresFullStructuralReview: strategy !== "A_EMPTY_DATABASE",
  };
}

export const REQUIRED_STAGING_DOMAIN_TABLES = [
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

export const REQUIRED_STAGING_ENUMS = [
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

export class StagingSchemaContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingSchemaContractError";
  }
}

export type StagingSchemaContractInput = {
  tables: Iterable<string>;
  enums: Iterable<string>;
  prismaMigrationHistory: {
    tablePresent: boolean;
    appliedCount: number;
    unfinishedCount: number;
  };
};

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new StagingSchemaContractError(`${label} must be a non-negative integer`);
  }
}

export function assertStagingSchemaContract(input: StagingSchemaContractInput): void {
  const existingTables = new Set(input.tables);
  const missingTables = REQUIRED_STAGING_DOMAIN_TABLES.filter(
    (tableName) => !existingTables.has(tableName),
  );
  if (missingTables.length > 0) {
    throw new StagingSchemaContractError(
      `missing required domain tables: ${missingTables.join(", ")}`,
    );
  }

  const existingEnums = new Set(input.enums);
  const missingEnums = REQUIRED_STAGING_ENUMS.filter(
    (enumName) => !existingEnums.has(enumName),
  );
  if (missingEnums.length > 0) {
    throw new StagingSchemaContractError(
      `missing required domain enums: ${missingEnums.join(", ")}`,
    );
  }

  if (!input.prismaMigrationHistory.tablePresent) {
    throw new StagingSchemaContractError(
      "_prisma_migrations table is required; authoritative migration history is not established",
    );
  }

  assertNonNegativeInteger(
    input.prismaMigrationHistory.appliedCount,
    "Prisma applied migration count",
  );
  assertNonNegativeInteger(
    input.prismaMigrationHistory.unfinishedCount,
    "Prisma unfinished migration count",
  );

  if (input.prismaMigrationHistory.appliedCount < 1) {
    throw new StagingSchemaContractError(
      "_prisma_migrations contains no successfully applied migration; authoritative migration history is not established",
    );
  }

  if (input.prismaMigrationHistory.unfinishedCount > 0) {
    throw new StagingSchemaContractError(
      `Prisma migration history contains ${input.prismaMigrationHistory.unfinishedCount} unfinished migration(s)`,
    );
  }
}

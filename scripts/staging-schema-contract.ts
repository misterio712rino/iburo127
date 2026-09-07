export const REQUIRED_STAGING_DOMAIN_TABLES = [
  "User",
  "Role",
  "UserRole",
  "AuthIdentity",
  "UserSecurityEvent",
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
  "StoredFileDeletion",
  "PotentialClientLead",
] as const;

export const REQUIRED_STAGING_ENUMS = [
  "UserStatus",
  "ClientCaseStatus",
  "QuestionnaireStatus",
  "PracticumProgressStatus",
  "TaskStatus",
  "CaseDocumentStatus",
  "StoredFileStatus",
  "StoredFileDeletionStatus",
  "NotificationDeliveryChannel",
  "NotificationDeliveryStatus",
  "PotentialClientLeadContactType",
  "PotentialClientLeadStatus",
] as const;

export const REQUIRED_STORED_FILE_STATUS_VALUES = [
  "PENDING_UPLOAD",
  "PENDING_SCAN",
  "SCANNING",
  "READY",
  "QUARANTINED",
  "SCAN_FAILED",
] as const;

export const REQUIRED_STORED_FILE_SCAN_COLUMNS = [
  "scanAttemptCount",
  "scanNextAttemptAt",
  "scanLeaseUntil",
  "scanLeaseToken",
  "scanProvider",
  "scanLastErrorCode",
  "scannedAt",
  "quarantinedAt",
  "readyAt",
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
  storedFile: {
    columns: Iterable<string>;
    statusValues: Iterable<string>;
  };
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

  const storedFileColumns = new Set(input.storedFile.columns);
  const missingStoredFileColumns = REQUIRED_STORED_FILE_SCAN_COLUMNS.filter(
    (columnName) => !storedFileColumns.has(columnName),
  );
  if (missingStoredFileColumns.length > 0) {
    throw new StagingSchemaContractError(
      `missing StoredFile scan columns: ${missingStoredFileColumns.join(", ")}`,
    );
  }

  const storedFileStatusValues = new Set(input.storedFile.statusValues);
  const missingStoredFileStatuses = REQUIRED_STORED_FILE_STATUS_VALUES.filter(
    (status) => !storedFileStatusValues.has(status),
  );
  if (missingStoredFileStatuses.length > 0) {
    throw new StagingSchemaContractError(
      `missing StoredFileStatus values: ${missingStoredFileStatuses.join(", ")}`,
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

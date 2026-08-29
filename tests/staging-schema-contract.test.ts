import assert from "node:assert/strict";

import {
  assertStagingSchemaContract,
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
  REQUIRED_STORED_FILE_SCAN_COLUMNS,
  REQUIRED_STORED_FILE_STATUS_VALUES,
  StagingSchemaContractError,
} from "@/scripts/staging-schema-contract";

const validInput = {
  tables: [...REQUIRED_STAGING_DOMAIN_TABLES, "_prisma_migrations"],
  enums: [...REQUIRED_STAGING_ENUMS],
  storedFile: {
    columns: [...REQUIRED_STORED_FILE_SCAN_COLUMNS],
    statusValues: [...REQUIRED_STORED_FILE_STATUS_VALUES],
  },
  prismaMigrationHistory: {
    tablePresent: true,
    appliedCount: 1,
    unfinishedCount: 0,
  },
};

assert.ok(REQUIRED_STAGING_DOMAIN_TABLES.includes("UserSecurityEvent"));
assert.ok(REQUIRED_STORED_FILE_STATUS_VALUES.includes("QUARANTINED"));
assert.ok(REQUIRED_STORED_FILE_SCAN_COLUMNS.includes("scanLeaseToken"));
assert.doesNotThrow(() => assertStagingSchemaContract(validInput));

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      tables: validInput.tables.filter((tableName) => tableName !== "ClientCase"),
    }),
  (error: unknown) => {
    assert.ok(error instanceof StagingSchemaContractError);
    assert.match(error.message, /missing required domain tables: ClientCase/);
    return true;
  },
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      tables: validInput.tables.filter((tableName) => tableName !== "UserSecurityEvent"),
    }),
  /missing required domain tables: UserSecurityEvent/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      enums: validInput.enums.filter((enumName) => enumName !== "ClientCaseStatus"),
    }),
  /missing required domain enums: ClientCaseStatus/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      storedFile: {
        ...validInput.storedFile,
        columns: validInput.storedFile.columns.filter(
          (columnName) => columnName !== "scanLeaseToken",
        ),
      },
    }),
  /missing StoredFile scan columns: scanLeaseToken/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      storedFile: {
        ...validInput.storedFile,
        statusValues: validInput.storedFile.statusValues.filter(
          (status) => status !== "QUARANTINED",
        ),
      },
    }),
  /missing StoredFileStatus values: QUARANTINED/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      prismaMigrationHistory: {
        ...validInput.prismaMigrationHistory,
        tablePresent: false,
      },
    }),
  /_prisma_migrations table is required/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      prismaMigrationHistory: {
        ...validInput.prismaMigrationHistory,
        appliedCount: 0,
      },
    }),
  /no successfully applied migration/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      prismaMigrationHistory: {
        ...validInput.prismaMigrationHistory,
        unfinishedCount: 2,
      },
    }),
  /contains 2 unfinished migration/,
);

assert.throws(
  () =>
    assertStagingSchemaContract({
      ...validInput,
      prismaMigrationHistory: {
        ...validInput.prismaMigrationHistory,
        appliedCount: -1,
      },
    }),
  /applied migration count must be a non-negative integer/,
);

console.log("STAGING_SCHEMA_CONTRACT_TEST_PASS");

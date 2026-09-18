import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertDocumentRevisionSchemaContract,
  assertStagingSchemaContract,
  REQUIRED_DOCUMENT_REVISION_ENUMS,
  REQUIRED_DOCUMENT_REVISION_TABLES,
  REQUIRED_STAGING_DOMAIN_TABLES,
  REQUIRED_STAGING_ENUMS,
  REQUIRED_STORED_FILE_SCAN_COLUMNS,
  REQUIRED_STORED_FILE_STATUS_VALUES,
  StagingSchemaContractError,
} from "@/scripts/staging-schema-contract";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";

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
assert.ok(REQUIRED_STAGING_DOMAIN_TABLES.includes("StoredFileDeletion"));
assert.ok(!new Set<string>(REQUIRED_STAGING_DOMAIN_TABLES).has("CaseDocumentRevision"));
assert.ok(REQUIRED_STAGING_ENUMS.includes("StoredFileDeletionStatus"));
assert.ok(!new Set<string>(REQUIRED_STAGING_ENUMS).has("CaseDocumentRevisionStatus"));
assert.deepEqual([...REQUIRED_DOCUMENT_REVISION_TABLES], ["CaseDocumentRevision"]);
assert.deepEqual([...REQUIRED_DOCUMENT_REVISION_ENUMS], ["CaseDocumentRevisionStatus"]);
assert.ok(REQUIRED_STORED_FILE_STATUS_VALUES.includes("QUARANTINED"));
assert.ok(REQUIRED_STORED_FILE_SCAN_COLUMNS.includes("scanLeaseToken"));
assert.doesNotThrow(() => assertStagingSchemaContract(validInput));
assert.throws(
  () => assertDocumentRevisionSchemaContract(validInput),
  /document revision schema not ready: tables=CaseDocumentRevision; enums=CaseDocumentRevisionStatus/,
);
assert.throws(
  () => assertDocumentRevisionSchemaContract({
    tables: [...validInput.tables, ...REQUIRED_DOCUMENT_REVISION_TABLES],
    enums: validInput.enums,
  }),
  /document revision schema not ready: tables=none; enums=CaseDocumentRevisionStatus/,
);
assert.doesNotThrow(() => assertDocumentRevisionSchemaContract({
  tables: [...validInput.tables, ...REQUIRED_DOCUMENT_REVISION_TABLES],
  enums: [...validInput.enums, ...REQUIRED_DOCUMENT_REVISION_ENUMS],
}));

const stagingTargetEnv = {
  IB_DB_TARGET: "staging",
  DATABASE_URL: "postgresql://stage_user@stage.pg.internal:5432/iburo_stage",
  IB_STAGING_DATABASE_NAME: "iburo_stage",
  IB_STAGING_DATABASE_HOST: "stage.pg.internal",
  IB_STAGING_DATABASE_USER: "stage_user",
  IB_STAGING_BETTER_AUTH_SCHEMA: "public",
};
assert.doesNotThrow(() => requireStagingDatabaseTarget(stagingTargetEnv));
assert.throws(
  () =>
    requireStagingDatabaseTarget({
      ...stagingTargetEnv,
      IB_STAGING_BETTER_AUTH_SCHEMA: "auth",
    }),
  /IB_STAGING_BETTER_AUTH_SCHEMA must be exactly "public"/,
);
assert.doesNotThrow(() =>
  requireStagingDatabaseTarget({
    ...stagingTargetEnv,
    IB_STAGING_BETTER_AUTH_SCHEMA: undefined,
  }),
);

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
      tables: validInput.tables.filter((tableName) => tableName !== "StoredFileDeletion"),
    }),
  /missing required domain tables: StoredFileDeletion/,
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
      enums: validInput.enums.filter(
        (enumName) => enumName !== "StoredFileDeletionStatus",
      ),
    }),
  /missing required domain enums: StoredFileDeletionStatus/,
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

const stagingBaselineSource = await readFile(
  resolve("app/%5Fiburo/staging-db-baseline/route.ts"),
  "utf8",
);
assert.match(stagingBaselineSource, /client\.query\("BEGIN READ ONLY"\)/);
assert.match(stagingBaselineSource, /DOCUMENT_REVISION_MIGRATION = "20260917_case_document_revisions"/);
assert.match(stagingBaselineSource, /appliedNames\.size !== appliedMigrations\.length/);
assert.match(stagingBaselineSource, /EXPECTED_PRISMA_MIGRATIONS\.every\(\(name\) => appliedNames\.has\(name\)\)/);
assert.match(stagingBaselineSource, /revisionMigrationApplied === null/);
assert.match(stagingBaselineSource, /assertDocumentRevisionSchemaContract\(\{ tables: tableNames, enums: enumNames \}\)/);
assert.match(stagingBaselineSource, /else if \(revisionTablePresent \|\| revisionEnumPresent\)/);
assert.match(stagingBaselineSource, /documentRevision: \{\s*migrationApplied: revisionMigrationApplied,\s*schemaReady: revisionMigrationApplied,/);
assert.doesNotMatch(stagingBaselineSource, /expectedCount: EXPECTED_PRISMA_MIGRATIONS\.length \+ 1/);

console.log("STAGING_SCHEMA_CONTRACT_TEST_PASS");

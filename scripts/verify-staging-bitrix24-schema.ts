import "dotenv/config";

import {
  BITRIX24_REQUEST_FAILED,
  getBitrix24ItemFields,
} from "@/server/integrations/bitrix24/core";
import {
  BITRIX24_CASE_SCHEMA_CONFIG_ERROR,
  readBitrix24CaseSchemaConfig,
} from "@/server/integrations/bitrix24/case-schema-config";
import {
  assertStagingBitrix24Target,
  STAGING_BITRIX24_TARGET_GUARD,
} from "@/scripts/staging-bitrix24-target-guard";

const FAIL = "STAGING_BITRIX24_SCHEMA_VERIFY_FAIL";

function fail(message: string): never {
  console.error(`${FAIL}: ${message}`);
  process.exit(1);
}

let webhookConfig;
let schemaConfig;
try {
  webhookConfig = assertStagingBitrix24Target(process.env);
  schemaConfig = readBitrix24CaseSchemaConfig(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (
    message.startsWith(`${STAGING_BITRIX24_TARGET_GUARD}:`) ||
    message.startsWith(`${BITRIX24_CASE_SCHEMA_CONFIG_ERROR}:`)
  ) {
    fail(message);
  }
  fail("CONFIG_UNEXPECTED");
}

try {
  const fields = await getBitrix24ItemFields(webhookConfig, schemaConfig.entityTypeId);

  for (const fieldName of schemaConfig.requiredWritableFields) {
    const field = fields[fieldName];
    if (!field) fail(`required CRM field is missing: ${fieldName}`);
    if (field.isReadOnly || field.isImmutable) {
      fail(`required CRM field is not writable: ${fieldName}`);
    }
  }

  console.log(`Bitrix24 CRM entity type verified: ${schemaConfig.entityTypeId}`);
  console.log(`Required writable field count verified: ${schemaConfig.requiredWritableFields.length}`);
  console.log("CRM field titles/settings printed: 0");
  console.log("CRM items created or updated: 0");
  console.log("STAGING_BITRIX24_SCHEMA_VERIFY_PASS");
} catch (error) {
  const safeCode =
    error instanceof Error && error.message.startsWith(`${BITRIX24_REQUEST_FAILED}:`)
      ? error.message
      : `${BITRIX24_REQUEST_FAILED}:UNEXPECTED`;
  fail(safeCode);
}

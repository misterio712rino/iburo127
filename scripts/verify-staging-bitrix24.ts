import "dotenv/config";

import {
  BITRIX24_REQUEST_FAILED,
  getBitrix24MethodAvailability,
  getBitrix24ProfileIdentity,
} from "@/server/integrations/bitrix24/core";
import {
  assertStagingBitrix24Target,
  STAGING_BITRIX24_TARGET_GUARD,
} from "@/scripts/staging-bitrix24-target-guard";

const FAIL = "STAGING_BITRIX24_VERIFY_FAIL";

function fail(message: string): never {
  console.error(`${FAIL}: ${message}`);
  process.exit(1);
}

let config;
try {
  config = assertStagingBitrix24Target(process.env);
} catch (error) {
  const code =
    error instanceof Error && error.message.startsWith(`${STAGING_BITRIX24_TARGET_GUARD}:`)
      ? error.message
      : `${STAGING_BITRIX24_TARGET_GUARD}:UNEXPECTED`;
  fail(code);
}

try {
  await getBitrix24ProfileIdentity(config);
  const add = await getBitrix24MethodAvailability(config, "crm.item.add");
  const update = await getBitrix24MethodAvailability(config, "crm.item.update");

  if (!add.isExisting || !update.isExisting) {
    fail("required CRM methods do not exist on the staging portal");
  }
  if (!add.isAvailable || !update.isAvailable) {
    fail("staging webhook lacks permission for required CRM methods");
  }

  console.log("Bitrix24 staging webhook identity verified");
  console.log("crm.item.add: available");
  console.log("crm.item.update: available");
  console.log("CRM items created or updated: 0");
  console.log("Profile personal fields printed: 0");
  console.log("STAGING_BITRIX24_VERIFY_PASS");
} catch (error) {
  const safeCode =
    error instanceof Error && error.message.startsWith(`${BITRIX24_REQUEST_FAILED}:`)
      ? error.message
      : `${BITRIX24_REQUEST_FAILED}:UNEXPECTED`;
  fail(safeCode);
}

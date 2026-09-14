import {
  BITRIX24_CASE_PROJECTION_KEYS,
  parseBitrix24CaseFieldMap,
  type Bitrix24CaseFieldMap,
} from "./case-projection";

export const BITRIX24_CASE_SCHEMA_CONFIG_ERROR = "BITRIX24_CASE_SCHEMA_CONFIG_ERROR";

export type Bitrix24CaseSchemaConfig = {
  entityTypeId: number;
  fieldMap: Bitrix24CaseFieldMap;
  requiredWritableFields: readonly string[];
};

function fail(code: string): never {
  throw new Error(`${BITRIX24_CASE_SCHEMA_CONFIG_ERROR}:${code}`);
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) fail(`MISSING_${name}`);
  return value;
}

export function readBitrix24CaseSchemaConfig(
  env: Record<string, string | undefined> = process.env,
): Bitrix24CaseSchemaConfig {
  const entityTypeRaw = required(env, "BITRIX24_CASE_ENTITY_TYPE_ID");
  const entityTypeId = Number(entityTypeRaw);
  if (
    !Number.isSafeInteger(entityTypeId) ||
    entityTypeId < 1 ||
    entityTypeId > 2_147_483_647 ||
    String(entityTypeId) !== entityTypeRaw
  ) {
    fail("ENTITY_TYPE_ID");
  }

  let fieldMap: Bitrix24CaseFieldMap;
  try {
    fieldMap = parseBitrix24CaseFieldMap(required(env, "BITRIX24_CASE_FIELD_MAP"));
  } catch {
    fail("FIELD_MAP");
  }

  return {
    entityTypeId,
    fieldMap,
    requiredWritableFields: BITRIX24_CASE_PROJECTION_KEYS.map((key) => fieldMap[key]),
  };
}

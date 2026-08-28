export const BITRIX24_CASE_SCHEMA_CONFIG_ERROR = "BITRIX24_CASE_SCHEMA_CONFIG_ERROR";

export type Bitrix24CaseSchemaConfig = {
  entityTypeId: number;
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

  const rawFields = required(env, "BITRIX24_CASE_REQUIRED_WRITABLE_FIELDS");
  const fields = rawFields.split(",").map((value) => value.trim());
  if (fields.some((value) => !value)) fail("FIELD_LIST");
  if (fields.length < 1 || fields.length > 32) fail("FIELD_LIST");

  const unique = [...new Set(fields)];
  if (unique.length !== fields.length) fail("FIELD_DUPLICATE");
  for (const field of unique) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(field)) fail("FIELD_NAME");
  }

  return {
    entityTypeId,
    requiredWritableFields: unique,
  };
}

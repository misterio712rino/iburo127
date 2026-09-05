export const BITRIX24_CASE_PROJECTION_INVALID = "BITRIX24_CASE_PROJECTION_INVALID";
export const BITRIX24_CASE_FIELD_MAP_INVALID = "BITRIX24_CASE_FIELD_MAP_INVALID";

export const BITRIX24_CASE_PROJECTION_KEYS = [
  "caseNumber",
  "planCode",
  "stageCode",
  "status",
] as const;

export type Bitrix24CaseProjectionKey = (typeof BITRIX24_CASE_PROJECTION_KEYS)[number];
export type Bitrix24CaseStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export type Bitrix24CaseProjectionInput = {
  caseNumber: string;
  planCode: string;
  stageCode: string;
  status: Bitrix24CaseStatus;
};

export type Bitrix24CaseProjection = Readonly<Bitrix24CaseProjectionInput>;
export type Bitrix24CaseFieldMap = Readonly<Record<Bitrix24CaseProjectionKey, string>>;

const STATUS_SET = new Set<Bitrix24CaseStatus>([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);
const KEY_SET = new Set<string>(BITRIX24_CASE_PROJECTION_KEYS);
const RESERVED_FIELD_NAMES = new Set(["__proto__", "prototype", "constructor"]);

function projectionFail(code: string): never {
  throw new Error(`${BITRIX24_CASE_PROJECTION_INVALID}:${code}`);
}

function fieldMapFail(code: string): never {
  throw new Error(`${BITRIX24_CASE_FIELD_MAP_INVALID}:${code}`);
}

function requireOpaqueValue(value: string, name: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    projectionFail(name);
  }
  return normalized;
}

function requireCode(value: string, name: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(normalized)) projectionFail(name);
  return normalized;
}

export function buildBitrix24CaseProjection(
  input: Bitrix24CaseProjectionInput,
): Bitrix24CaseProjection {
  const status = input.status;
  if (!STATUS_SET.has(status)) projectionFail("STATUS");

  return Object.freeze({
    caseNumber: requireOpaqueValue(input.caseNumber, "CASE_NUMBER", 128),
    planCode: requireCode(input.planCode, "PLAN_CODE"),
    stageCode: requireCode(input.stageCode, "STAGE_CODE"),
    status,
  });
}

function requireFieldName(value: string): string {
  if (
    !/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(value) ||
    RESERVED_FIELD_NAMES.has(value.toLowerCase())
  ) {
    fieldMapFail("FIELD_NAME");
  }
  return value;
}

export function parseBitrix24CaseFieldMap(raw: string): Bitrix24CaseFieldMap {
  const entries = raw.split(",").map((entry) => entry.trim());
  if (entries.length !== BITRIX24_CASE_PROJECTION_KEYS.length || entries.some((entry) => !entry)) {
    fieldMapFail("ENTRY_COUNT");
  }

  const mapping = new Map<Bitrix24CaseProjectionKey, string>();
  const targetNames = new Set<string>();

  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0 || separator !== entry.lastIndexOf("=")) fieldMapFail("ENTRY_FORMAT");
    const source = entry.slice(0, separator).trim();
    const target = requireFieldName(entry.slice(separator + 1).trim());
    if (!KEY_SET.has(source)) fieldMapFail("SOURCE_KEY");
    const sourceKey = source as Bitrix24CaseProjectionKey;
    if (mapping.has(sourceKey)) fieldMapFail("SOURCE_DUPLICATE");
    if (targetNames.has(target)) fieldMapFail("TARGET_DUPLICATE");
    mapping.set(sourceKey, target);
    targetNames.add(target);
  }

  for (const key of BITRIX24_CASE_PROJECTION_KEYS) {
    if (!mapping.has(key)) fieldMapFail("SOURCE_MISSING");
  }

  return Object.freeze(
    Object.fromEntries(
      BITRIX24_CASE_PROJECTION_KEYS.map((key) => [key, mapping.get(key)!]),
    ) as Record<Bitrix24CaseProjectionKey, string>,
  );
}

export function mapBitrix24CaseProjection(
  projection: Bitrix24CaseProjection,
  fieldMap: Bitrix24CaseFieldMap,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      BITRIX24_CASE_PROJECTION_KEYS.map((key) => [fieldMap[key], projection[key]]),
    ),
  );
}

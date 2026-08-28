import "server-only";

export const FILE_TRANSPORT_INVALID_INPUT = "FILE_TRANSPORT_INVALID_INPUT";

function parseNonEmptyString(value: unknown) {
  if (typeof value !== "string") throw new Error(FILE_TRANSPORT_INVALID_INPUT);
  const normalized = value.trim();
  if (!normalized) throw new Error(FILE_TRANSPORT_INVALID_INPUT);
  return normalized;
}

export function parseStoredFileClientCaseId(value: unknown) {
  return parseNonEmptyString(value);
}

export function parseStoredFileId(value: unknown) {
  return parseNonEmptyString(value);
}

export function parseStoredFileSignedUrlTtl(value: unknown) {
  if (value === undefined) return 120;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 30 || value > 900) {
    throw new Error(FILE_TRANSPORT_INVALID_INPUT);
  }
  return value;
}

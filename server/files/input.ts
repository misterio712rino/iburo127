import "server-only";

export const FILE_TRANSPORT_INVALID_INPUT = "FILE_TRANSPORT_INVALID_INPUT";
export const MAX_PRIVATE_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function invalid(): never {
  throw new Error(FILE_TRANSPORT_INVALID_INPUT);
}

function parseNonEmptyString(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") invalid();
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/.test(normalized)) invalid();
  return normalized;
}

function parseUuid(value: unknown) {
  const normalized = parseNonEmptyString(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) invalid();
  return normalized;
}

export function parseStoredFileClientCaseId(value: unknown) {
  return parseUuid(value);
}

export function parseStoredFileId(value: unknown) {
  return parseUuid(value);
}

export function parseStoredFileSignedUrlTtl(value: unknown) {
  if (value === undefined) return 120;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 30 || value > 900) invalid();
  return value;
}

export function parsePrepareStoredFileUploadInput(value: unknown, clientCaseId: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const input = value as Record<string, unknown>;
  const fileName = parseNonEmptyString(input.fileName, 500);
  const mimeType = parseNonEmptyString(input.mimeType, 200).toLowerCase();
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) invalid();

  if (typeof input.sizeBytes !== "number" || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_PRIVATE_UPLOAD_BYTES) invalid();

  return {
    clientCaseId: parseStoredFileClientCaseId(clientCaseId),
    fileName,
    mimeType,
    sizeBytes: BigInt(input.sizeBytes),
  };
}

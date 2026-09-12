import "server-only";

export const DOCUMENT_INVALID_INPUT = "DOCUMENT_INVALID_INPUT";

function invalidInput(): never {
  throw new Error(DOCUMENT_INVALID_INPUT);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidInput();
  return value as Record<string, unknown>;
}

function parseNonEmptyString(value: unknown): string {
  if (typeof value !== "string") invalidInput();
  const normalized = value.trim();
  if (!normalized) invalidInput();
  return normalized;
}

function parseExpectedVersion(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) invalidInput();
  return value as number;
}

export function parseDocumentClientCaseId(value: unknown) {
  return parseNonEmptyString(value);
}

export function parseDocumentCode(value: unknown) {
  return parseNonEmptyString(value);
}

export function parseDocumentMutationInput(value: unknown) {
  const input = parseRecord(value);
  return {
    clientCaseId: parseNonEmptyString(input.clientCaseId),
    documentCode: parseNonEmptyString(input.documentCode),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

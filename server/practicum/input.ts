import "server-only";

export const PRACTICUM_INVALID_INPUT = "PRACTICUM_INVALID_INPUT";

function invalidInput(): never {
  throw new Error(PRACTICUM_INVALID_INPUT);
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

function parseExpectedVersion(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) invalidInput();
  return value as number;
}

export function parsePracticumClientCaseId(value: unknown) {
  return parseNonEmptyString(value);
}

export function parseCompletePracticumLessonInput(value: unknown) {
  const input = parseRecord(value);
  return {
    clientCaseId: parseNonEmptyString(input.clientCaseId),
    lessonId: parseNonEmptyString(input.lessonId),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

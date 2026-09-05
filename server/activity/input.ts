import "server-only";

export const ACTIVITY_INVALID_INPUT = "ACTIVITY_INVALID_INPUT";

function invalidInput(): never {
  throw new Error(ACTIVITY_INVALID_INPUT);
}

export function parseActivityClientCaseId(value: unknown) {
  if (typeof value !== "string") invalidInput();
  const normalized = value.trim();
  if (!normalized) invalidInput();
  return normalized;
}

export function parseActivityLimit(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(numberValue) || (numberValue as number) < 1 || (numberValue as number) > 200) {
    invalidInput();
  }
  return numberValue as number;
}

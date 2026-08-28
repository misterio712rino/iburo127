import "server-only";

import type { TaskStatus } from "@/server/domain/tasks/contracts";

export const TASK_INVALID_INPUT = "TASK_INVALID_INPUT";

function invalidInput(): never {
  throw new Error(TASK_INVALID_INPUT);
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

function parseTaskStatus(value: unknown): TaskStatus {
  if (value === "NEW" || value === "WORKING" || value === "DONE") return value;
  return invalidInput();
}

export function parseTaskId(value: unknown) {
  return parseNonEmptyString(value);
}

export function parseUpdateTaskStatusInput(value: unknown) {
  const input = parseRecord(value);
  return {
    taskId: parseNonEmptyString(input.taskId),
    status: parseTaskStatus(input.status),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

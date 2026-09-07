import "server-only";

import type { TaskStatus } from "@/server/domain/tasks/contracts";

export const TASK_INVALID_INPUT = "TASK_INVALID_INPUT";

const MAX_TASK_TITLE_LENGTH = 160;
const MAX_TASK_DESCRIPTION_LENGTH = 2000;

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

function parseBoundedString(value: unknown, maxLength: number): string {
  const normalized = parseNonEmptyString(value);
  if (normalized.length > maxLength) invalidInput();
  return normalized;
}

function parseOptionalDescription(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") invalidInput();
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_TASK_DESCRIPTION_LENGTH) invalidInput();
  return normalized;
}

function parseDueAt(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 64) invalidInput();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalidInput();
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2100) invalidInput();
  return parsed;
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

export function parseCreateTaskInput(value: unknown) {
  const input = parseRecord(value);
  return {
    clientCaseId: parseNonEmptyString(input.clientCaseId),
    title: parseBoundedString(input.title, MAX_TASK_TITLE_LENGTH),
    description: parseOptionalDescription(input.description),
    dueAt: parseDueAt(input.dueAt),
  };
}

export function parseUpdateTaskStatusInput(value: unknown) {
  const input = parseRecord(value);
  return {
    taskId: parseNonEmptyString(input.taskId),
    status: parseTaskStatus(input.status),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

import "server-only";

import type { QuestionnaireAnswer } from "@/lib/platform/types";

export const QUESTIONNAIRE_INVALID_INPUT = "QUESTIONNAIRE_INVALID_INPUT";

function invalidInput(): never {
  throw new Error(QUESTIONNAIRE_INVALID_INPUT);
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

function parseQuestionnaireAnswer(value: unknown): QuestionnaireAnswer {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return invalidInput();
}

export function parseClientCaseId(value: unknown): string {
  return parseNonEmptyString(value);
}

export function parseSaveQuestionnaireAnswerInput(value: unknown) {
  const input = parseRecord(value);
  return {
    clientCaseId: parseNonEmptyString(input.clientCaseId),
    fieldId: parseNonEmptyString(input.fieldId),
    value: parseQuestionnaireAnswer(input.value),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

export function parseCompleteQuestionnaireSectionInput(value: unknown) {
  const input = parseRecord(value);
  return {
    clientCaseId: parseNonEmptyString(input.clientCaseId),
    sectionId: parseNonEmptyString(input.sectionId),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

export function parseCompleteQuestionnaireInput(value: unknown) {
  const input = parseRecord(value);
  return {
    clientCaseId: parseNonEmptyString(input.clientCaseId),
    expectedVersion: parseExpectedVersion(input.expectedVersion),
  };
}

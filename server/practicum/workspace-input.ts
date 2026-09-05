import "server-only";

import type { PracticumHomeworkReviewDecision } from "@/server/domain/practicum/workspace-contracts";
import { PRACTICUM_INVALID_INPUT } from "@/server/practicum/input";

function invalidInput(): never {
  throw new Error(PRACTICUM_INVALID_INPUT);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidInput();
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string") invalidInput();
  const text = value.trim();
  if (!text) invalidInput();
  return text;
}

function stringValue(value: unknown): string {
  if (typeof value !== "string") invalidInput();
  return value;
}

export function parsePracticumWorkspaceIdentity(input: {
  clientCaseId: unknown;
  lessonId: unknown;
}) {
  return {
    clientCaseId: nonEmptyString(input.clientCaseId),
    lessonId: nonEmptyString(input.lessonId),
  };
}

export function parsePracticumHomeworkMutation(
  value: unknown,
  identity: { clientCaseId: unknown; lessonId: unknown },
) {
  const body = record(value);
  const action = nonEmptyString(body.action);
  if (action !== "save_draft" && action !== "submit") invalidInput();
  return {
    ...parsePracticumWorkspaceIdentity(identity),
    action,
    answerText: stringValue(body.answerText),
  } as const;
}

export function parsePracticumHomeworkReview(
  value: unknown,
  identity: { clientCaseId: unknown; lessonId: unknown },
) {
  const body = record(value);
  const decision = nonEmptyString(body.decision);
  if (decision !== "CHANGES_REQUESTED" && decision !== "ACCEPTED") invalidInput();
  return {
    ...parsePracticumWorkspaceIdentity(identity),
    decision: decision as PracticumHomeworkReviewDecision,
    comment: stringValue(body.comment),
  };
}

export function parsePracticumLessonMessage(
  value: unknown,
  identity: { clientCaseId: unknown; lessonId: unknown },
) {
  const body = record(value);
  return {
    ...parsePracticumWorkspaceIdentity(identity),
    body: stringValue(body.body),
  };
}

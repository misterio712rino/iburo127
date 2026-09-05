import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import {
  QUESTIONNAIRE_NOT_FOUND,
  QUESTIONNAIRE_VERSION_CONFLICT,
} from "@/server/domain/questionnaire/contracts";
import {
  QUESTIONNAIRE_ALREADY_COMPLETED,
  QUESTIONNAIRE_CASE_NOT_FOUND,
  QUESTIONNAIRE_FORBIDDEN,
  QUESTIONNAIRE_INCOMPLETE,
  QUESTIONNAIRE_INCOMPLETE_SECTION,
  QUESTIONNAIRE_INVALID_FIELD,
  QUESTIONNAIRE_INVALID_SECTION,
} from "@/server/domain/questionnaire/service";
import { QUESTIONNAIRE_INVALID_INPUT } from "@/server/questionnaire/input";

export type QuestionnaireTransportErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "VERSION_CONFLICT"
  | "INTERNAL_ERROR";

export type QuestionnaireTransportError = {
  code: QuestionnaireTransportErrorCode;
  status: 400 | 401 | 403 | 404 | 409 | 500;
};

export type QuestionnaireOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: QuestionnaireTransportError };

export function classifyQuestionnaireError(error: unknown): QuestionnaireTransportError {
  const code = error instanceof Error ? error.message : "";

  switch (code) {
    case UNAUTHENTICATED:
      return { code: "UNAUTHENTICATED", status: 401 };
    case QUESTIONNAIRE_FORBIDDEN:
      return { code: "FORBIDDEN", status: 403 };
    case QUESTIONNAIRE_CASE_NOT_FOUND:
    case QUESTIONNAIRE_NOT_FOUND:
      return { code: "NOT_FOUND", status: 404 };
    case QUESTIONNAIRE_INVALID_INPUT:
    case QUESTIONNAIRE_INVALID_FIELD:
    case QUESTIONNAIRE_INVALID_SECTION:
      return { code: "INVALID_INPUT", status: 400 };
    case QUESTIONNAIRE_ALREADY_COMPLETED:
    case QUESTIONNAIRE_INCOMPLETE_SECTION:
    case QUESTIONNAIRE_INCOMPLETE:
      return { code: "INVALID_TRANSITION", status: 409 };
    case QUESTIONNAIRE_VERSION_CONFLICT:
      return { code: "VERSION_CONFLICT", status: 409 };
    default:
      return { code: "INTERNAL_ERROR", status: 500 };
  }
}

export async function executeQuestionnaireOperation<T>(
  operation: () => Promise<T>,
): Promise<QuestionnaireOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: classifyQuestionnaireError(error) };
  }
}

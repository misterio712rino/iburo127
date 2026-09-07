import "server-only";

import type {
  QuestionnaireOperationResult,
  QuestionnaireTransportErrorCode,
} from "@/server/questionnaire/transport";
import { privateJsonResponse } from "@/server/http/private-json";

export type QuestionnaireHttpSuccessBody<T> = {
  ok: true;
  data: T;
};

export type QuestionnaireHttpErrorBody = {
  ok: false;
  error: {
    code: QuestionnaireTransportErrorCode;
  };
};

export function toQuestionnaireHttpResponse<T>(result: QuestionnaireOperationResult<T>): Response {
  if (result.ok) {
    const body: QuestionnaireHttpSuccessBody<T> = { ok: true, data: result.data };
    return privateJsonResponse(body);
  }

  const body: QuestionnaireHttpErrorBody = {
    ok: false,
    error: { code: result.error.code },
  };

  return privateJsonResponse(body, result.error.status);
}

import "server-only";

import type { QuestionnaireOperationResult } from "@/server/questionnaire/transport";

export type QuestionnaireHttpSuccessBody<T> = {
  ok: true;
  data: T;
};

export type QuestionnaireHttpErrorBody = {
  ok: false;
  error: {
    code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "VERSION_CONFLICT" | "INTERNAL_ERROR";
  };
};

export function toQuestionnaireHttpResponse<T>(result: QuestionnaireOperationResult<T>): Response {
  if (result.ok) {
    const body: QuestionnaireHttpSuccessBody<T> = { ok: true, data: result.data };
    return Response.json(body, { status: 200 });
  }

  const body: QuestionnaireHttpErrorBody = {
    ok: false,
    error: { code: result.error.code },
  };

  return Response.json(body, { status: result.error.status });
}

import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { requireServerActor } from "@/server/auth/runtime";
import {
  RETENTION_CASE_NOT_FOUND,
  RETENTION_DECISION_CONFLICT,
} from "@/server/domain/files/retention-decision-service";
import type { RetentionChoice } from "@/server/domain/files/retention-policy";
import { getFileRetentionDecisionService } from "@/server/files/retention-decision-runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(code: string, status: number) {
  return privateJsonResponse({ ok: false, error: { code } }, status);
}

function classify(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "UNAUTHENTICATED") return failure("UNAUTHENTICATED", 401);
  if (code === "RETENTION_FORBIDDEN") return failure("FORBIDDEN", 403);
  if (code === RETENTION_CASE_NOT_FOUND) return failure("NOT_FOUND", 404);
  if (
    code === RETENTION_DECISION_CONFLICT ||
    code === "RETENTION_CASE_NOT_COMPLETED" ||
    code === "RETENTION_COMPLETION_DATE_MISSING"
  ) {
    return failure("CONFLICT", 409);
  }
  return failure("INTERNAL_ERROR", 500);
}

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  if (!UUID_PATTERN.test(caseId)) return failure("INVALID_INPUT", 400);

  const body = await readBoundedJsonBody(request);
  if (!body.ok) return body.response;

  const value = body.value;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("choice" in value) ||
    (value.choice !== "DELETE_NOW" &&
      value.choice !== "KEEP_UNTIL_AUTOMATIC_DELETION")
  ) {
    return failure("INVALID_INPUT", 400);
  }

  try {
    const actor = await requireServerActor(createProductionSessionProvider());
    const decision = await getFileRetentionDecisionService().decide({
      actor,
      clientCaseId: caseId,
      choice: value.choice as RetentionChoice,
    });
    return privateJsonResponse({ ok: true, data: decision });
  } catch (error) {
    return classify(error);
  }
}

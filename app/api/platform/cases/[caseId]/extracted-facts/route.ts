import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import {
  EXTRACTED_FACTS_CONFLICT,
  EXTRACTED_FACTS_FORBIDDEN,
  EXTRACTED_FACTS_INVALID,
  EXTRACTED_FACTS_NOT_FOUND,
  listExtractedFacts,
  reviewExtractedFact,
} from "@/server/documents/extracted-facts";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";

type RouteContext = { params: Promise<{ caseId: string }> };

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "EXTRACTED_FACTS_FAILED";
  const status = code === "UNAUTHENTICATED" ? 401
    : code === EXTRACTED_FACTS_FORBIDDEN ? 403
      : code === EXTRACTED_FACTS_NOT_FOUND ? 404
        : code === EXTRACTED_FACTS_INVALID ? 400
          : code === EXTRACTED_FACTS_CONFLICT ? 409 : 500;
  return privateJsonResponse({ ok: false, error: { code: status === 500 ? "EXTRACTED_FACTS_FAILED" : code } }, status);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { caseId } = await context.params;
    const data = await listExtractedFacts(createProductionSessionProvider(), caseId);
    return privateJsonResponse({ ok: true, data });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await readBoundedJsonBody(request);
  if (!body.ok) return body.response;
  const value = body.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return privateJsonResponse({ ok: false, error: { code: EXTRACTED_FACTS_INVALID } }, 400);
  }
  const input = value as Record<string, unknown>;
  if (typeof input.factId !== "string" || (input.decision !== "CONFIRMED" && input.decision !== "REJECTED")) {
    return privateJsonResponse({ ok: false, error: { code: EXTRACTED_FACTS_INVALID } }, 400);
  }
  try {
    const { caseId } = await context.params;
    const data = await reviewExtractedFact(createProductionSessionProvider(), {
      caseId, factId: input.factId, decision: input.decision,
      ...(Object.hasOwn(input, "value") ? { value: input.value } : {}),
    });
    return privateJsonResponse({ ok: true, data });
  } catch (error) {
    return failure(error);
  }
}

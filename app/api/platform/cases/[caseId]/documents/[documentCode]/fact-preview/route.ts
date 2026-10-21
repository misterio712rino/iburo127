import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import {
  EXTRACTED_FACTS_FORBIDDEN,
  EXTRACTED_FACTS_INVALID,
  EXTRACTED_FACTS_NOT_FOUND,
  getConfirmedFactDraftPreview,
} from "@/server/documents/extracted-facts";
import { privateJsonResponse } from "@/server/http/private-json";

type RouteContext = { params: Promise<{ caseId: string; documentCode: string }> };

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "EXTRACTED_FACTS_FAILED";
  const status = code === "UNAUTHENTICATED" ? 401
    : code === EXTRACTED_FACTS_FORBIDDEN ? 403
      : code === EXTRACTED_FACTS_NOT_FOUND ? 404
        : code === EXTRACTED_FACTS_INVALID ? 400 : 500;
  return privateJsonResponse({ ok: false, error: { code: status === 500 ? "EXTRACTED_FACTS_FAILED" : code } }, status);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { caseId, documentCode } = await context.params;
    if (documentCode !== "bankruptcy-application" && documentCode !== "property-inventory" && documentCode !== "creditors-list") {
      throw new Error(EXTRACTED_FACTS_INVALID);
    }
    const data = await getConfirmedFactDraftPreview(
      createProductionSessionProvider(), caseId, documentCode,
    );
    return privateJsonResponse({ ok: true, data });
  } catch (error) {
    return failure(error);
  }
}

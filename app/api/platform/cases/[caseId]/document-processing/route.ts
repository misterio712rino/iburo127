import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { handleListDocumentProcessingStatuses } from "@/server/files/handlers";
import { toStoredFileHttpResponse } from "@/server/files/http";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  const result = await handleListDocumentProcessingStatuses(
    createProductionSessionProvider(),
    caseId,
  );
  return toStoredFileHttpResponse(result);
}

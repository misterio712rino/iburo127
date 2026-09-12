import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createDocumentRouteAdapter } from "@/server/documents/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string; documentCode: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { caseId, documentCode } = await context.params;
  return createDocumentRouteAdapter(
    createProductionSessionProvider(),
  ).sendForReview(caseId, documentCode, request);
}

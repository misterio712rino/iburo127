import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createDocumentRouteAdapter } from "@/server/documents/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return createDocumentRouteAdapter(createProductionSessionProvider()).list(caseId);
}

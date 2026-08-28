import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createAiRouteAdapter } from "@/server/ai/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return createAiRouteAdapter(createProductionSessionProvider()).reply(caseId, request);
}

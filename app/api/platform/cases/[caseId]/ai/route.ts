import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createAiRouteAdapter } from "@/server/ai/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

function adapter() {
  return createAiRouteAdapter(createProductionSessionProvider());
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return adapter().describe(caseId);
}

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return adapter().reply(caseId, request);
}

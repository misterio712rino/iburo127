import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createTaskRouteAdapter } from "@/server/tasks/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return createTaskRouteAdapter(
    createProductionSessionProvider(),
  ).create(caseId, request);
}

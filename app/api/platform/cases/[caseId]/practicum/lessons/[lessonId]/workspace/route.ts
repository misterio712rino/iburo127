import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createPracticumWorkspaceRouteAdapter } from "@/server/practicum/workspace-route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string; lessonId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { caseId, lessonId } = await context.params;
  return createPracticumWorkspaceRouteAdapter(createProductionSessionProvider()).get({
    clientCaseId: caseId,
    lessonId,
  });
}

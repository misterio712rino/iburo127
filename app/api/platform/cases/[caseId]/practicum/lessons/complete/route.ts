import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createPracticumRouteAdapter } from "@/server/practicum/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return createPracticumRouteAdapter(
    createProductionSessionProvider(),
  ).completeLesson(caseId, request);
}

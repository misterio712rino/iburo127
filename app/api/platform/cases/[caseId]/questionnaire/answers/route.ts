import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createQuestionnaireRouteAdapter } from "@/server/questionnaire/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return createQuestionnaireRouteAdapter(
    createProductionSessionProvider(),
  ).saveAnswer(caseId, request);
}

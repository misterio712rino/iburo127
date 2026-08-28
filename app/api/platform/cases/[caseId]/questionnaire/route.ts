import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createQuestionnaireRouteAdapter } from "@/server/questionnaire/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

function adapter() {
  return createQuestionnaireRouteAdapter(createProductionSessionProvider());
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return adapter().get(caseId);
}

export async function POST(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return adapter().getOrCreate(caseId);
}

import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createActivityRouteAdapter } from "@/server/activity/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

function adapter() {
  return createActivityRouteAdapter(createProductionSessionProvider());
}

export async function GET(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  const url = new URL(request.url);
  return adapter().list(caseId, url.searchParams.get("limit") ?? undefined);
}

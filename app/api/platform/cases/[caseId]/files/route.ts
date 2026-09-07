import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createStoredFileRouteAdapter } from "@/server/files/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

function adapter() {
  return createStoredFileRouteAdapter(createProductionSessionProvider());
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return adapter().list(caseId);
}

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params;
  return adapter().prepareUpload(caseId, request);
}

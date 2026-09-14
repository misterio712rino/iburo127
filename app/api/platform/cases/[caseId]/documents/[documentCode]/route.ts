import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createDocumentRouteAdapter } from "@/server/documents/route-adapter";

type RouteContext = {
  params: Promise<{ caseId: string; documentCode: string }>;
};

function adapter() {
  return createDocumentRouteAdapter(createProductionSessionProvider());
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId, documentCode } = await context.params;
  return adapter().get(caseId, documentCode);
}

export async function POST(_request: Request, context: RouteContext) {
  const { caseId, documentCode } = await context.params;
  return adapter().getOrCreate(caseId, documentCode);
}

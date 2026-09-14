import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createStoredFileRouteAdapter } from "@/server/files/route-adapter";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function adapter() {
  return createStoredFileRouteAdapter(createProductionSessionProvider());
}

export async function POST(_request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  return adapter().completeUpload(fileId);
}

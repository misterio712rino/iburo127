import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { createStoredFileRouteAdapter } from "@/server/files/route-adapter";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function adapter() {
  return createStoredFileRouteAdapter(createProductionSessionProvider());
}

export async function POST(request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const body = bodyResult.value;
  const expiresInSeconds =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).expiresInSeconds
      : undefined;

  return adapter().createDownloadUrl(fileId, expiresInSeconds);
}

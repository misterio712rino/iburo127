import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createStoredFileRouteAdapter } from "@/server/files/route-adapter";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

function adapter() {
  return createStoredFileRouteAdapter(createProductionSessionProvider());
}

export async function POST(request: Request, context: RouteContext) {
  const { fileId } = await context.params;

  let expiresInSeconds: unknown;
  try {
    const body = await request.json();
    expiresInSeconds = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).expiresInSeconds
      : undefined;
  } catch {
    expiresInSeconds = undefined;
  }

  return adapter().createDownloadUrl(fileId, expiresInSeconds);
}

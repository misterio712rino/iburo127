import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createNotificationRouteAdapter } from "@/server/notifications/route-adapter";

function adapter() {
  return createNotificationRouteAdapter(createProductionSessionProvider());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return adapter().list(url.searchParams.get("limit") ?? undefined);
}

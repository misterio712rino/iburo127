import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createNotificationRouteAdapter } from "@/server/notifications/route-adapter";

function adapter() {
  return createNotificationRouteAdapter(createProductionSessionProvider());
}

export async function POST() {
  return adapter().markAllRead();
}

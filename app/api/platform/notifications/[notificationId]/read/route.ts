import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createNotificationRouteAdapter } from "@/server/notifications/route-adapter";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

function adapter() {
  return createNotificationRouteAdapter(createProductionSessionProvider());
}

export async function POST(_request: Request, context: RouteContext) {
  const { notificationId } = await context.params;
  return adapter().markRead(notificationId);
}

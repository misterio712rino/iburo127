import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createTaskRouteAdapter } from "@/server/tasks/route-adapter";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return createTaskRouteAdapter(
    createProductionSessionProvider(),
  ).updateStatus(taskId, request);
}

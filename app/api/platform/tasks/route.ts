import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { createTaskRouteAdapter } from "@/server/tasks/route-adapter";

export async function GET() {
  return createTaskRouteAdapter(createProductionSessionProvider()).list();
}

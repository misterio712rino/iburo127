import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { handleListCaseActivity } from "@/server/activity/handlers";
import { toActivityHttpResponse } from "@/server/activity/http";

export function createActivityRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(clientCaseId: unknown, limit?: unknown): Promise<Response> {
      return toActivityHttpResponse(
        await handleListCaseActivity(sessionProvider, clientCaseId, limit),
      );
    },
  };
}

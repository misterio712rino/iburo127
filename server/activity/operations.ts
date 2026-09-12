import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { caseActivityService } from "@/server/activity/runtime";

export async function listCaseActivity(
  sessionProvider: SessionProvider,
  clientCaseId: string,
  limit?: number,
) {
  const actor = await requireServerActor(sessionProvider);
  return caseActivityService.list(actor, clientCaseId, limit);
}

import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { clientCaseService } from "@/server/client-cases/runtime";

export async function getCurrentPlatformActor(sessionProvider: SessionProvider) {
  return requireServerActor(sessionProvider);
}

export async function listAccessibleClientCases(sessionProvider: SessionProvider) {
  const actor = await requireServerActor(sessionProvider);
  return clientCaseService.listCases(actor);
}

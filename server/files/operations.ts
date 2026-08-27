import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { storedFileService } from "@/server/files/runtime";

export async function listStoredFiles(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return storedFileService.list(actor, clientCaseId);
}

export async function getStoredFile(
  sessionProvider: SessionProvider,
  fileId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return storedFileService.get(actor, fileId);
}

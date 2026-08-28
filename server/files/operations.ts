import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { storedFileService } from "@/server/files/runtime";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";

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

export async function createStoredFileDownloadUrl(
  sessionProvider: SessionProvider,
  fileId: string,
  expiresInSeconds = 120,
) {
  const actor = await requireServerActor(sessionProvider);
  const file = await storedFileService.get(actor, fileId);
  const storage = getPrivateObjectStorage();

  if (file.storageProvider !== storage.providerCode) {
    throw new Error("FILE_STORAGE_PROVIDER_MISMATCH");
  }

  return storage.createDownloadUrl({
    objectKey: file.objectKey,
    fileName: file.fileName,
    expiresInSeconds,
  });
}

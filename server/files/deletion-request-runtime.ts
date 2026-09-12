import "server-only";

import { StoredFileDeletionRequestService } from "@/server/domain/files/deletion-request-service";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { storedFileService } from "@/server/files/runtime";
import { PrismaStoredFileDeletionRepository } from "@/server/repositories/prisma/stored-file-deletion-repository";

let singleton: StoredFileDeletionRequestService | null = null;

export function getStoredFileDeletionRequestService() {
  if (singleton) return singleton;
  const storage = getPrivateObjectStorage();
  singleton = new StoredFileDeletionRequestService(
    storedFileService,
    new PrismaStoredFileDeletionRepository(),
    storage.providerCode,
  );
  return singleton;
}

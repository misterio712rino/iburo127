import "server-only";

import { StoredFileDeletionWorker } from "@/server/domain/files/deletion-worker";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaStoredFileDeletionRepository } from "@/server/repositories/prisma/stored-file-deletion-repository";

let singleton: StoredFileDeletionWorker | null = null;

export function getStoredFileDeletionWorker() {
  if (singleton) return singleton;

  singleton = new StoredFileDeletionWorker(
    new PrismaStoredFileDeletionRepository(),
    getPrivateObjectStorage(),
    {
      leaseSeconds: 120,
      maxAttempts: 5,
      retryBaseSeconds: 60,
      retryMaxSeconds: 3_600,
    },
  );
  return singleton;
}

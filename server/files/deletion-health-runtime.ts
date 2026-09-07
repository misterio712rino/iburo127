import "server-only";

import { StoredFileDeletionHealthService } from "@/server/domain/files/deletion-health";
import { PrismaStoredFileDeletionHealthRepository } from "@/server/repositories/prisma/stored-file-deletion-health-repository";

let singleton: StoredFileDeletionHealthService | null = null;

export function getStoredFileDeletionHealthService() {
  if (singleton) return singleton;
  singleton = new StoredFileDeletionHealthService(
    new PrismaStoredFileDeletionHealthRepository(),
  );
  return singleton;
}

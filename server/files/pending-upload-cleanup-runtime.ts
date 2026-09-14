import "server-only";

import { PendingUploadCleanupService } from "@/server/files/pending-upload-cleanup";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaStoredFileRepository } from "@/server/repositories/prisma/stored-file-repository";

let cleanupService: PendingUploadCleanupService | undefined;

export function getPendingUploadCleanupService() {
  if (cleanupService) return cleanupService;

  cleanupService = new PendingUploadCleanupService(
    new PrismaStoredFileRepository(),
    getPrivateObjectStorage(),
  );
  return cleanupService;
}

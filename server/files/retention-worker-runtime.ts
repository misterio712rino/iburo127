import "server-only";

import { FileRetentionWorker } from "@/server/domain/files/retention-worker";
import { PrismaFileRetentionDecisionRepository } from "@/server/repositories/prisma/file-retention-decision-repository";

let singleton: FileRetentionWorker | null = null;

export function getFileRetentionWorker() {
  if (singleton) return singleton;

  singleton = new FileRetentionWorker(new PrismaFileRetentionDecisionRepository(), {
    leaseSeconds: 120,
    maxAttempts: 8,
    retryBaseSeconds: 60,
    retryMaxSeconds: 21_600,
  });
  return singleton;
}

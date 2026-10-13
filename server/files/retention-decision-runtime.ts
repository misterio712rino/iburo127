import "server-only";

import { FileRetentionDecisionService } from "@/server/domain/files/retention-decision-service";
import { PrismaFileRetentionDecisionRepository } from "@/server/repositories/prisma/file-retention-decision-repository";

let singleton: FileRetentionDecisionService | null = null;

export function getFileRetentionDecisionService() {
  if (singleton) return singleton;
  singleton = new FileRetentionDecisionService(
    new PrismaFileRetentionDecisionRepository(),
  );
  return singleton;
}

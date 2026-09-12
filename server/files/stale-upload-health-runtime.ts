import "server-only";

import { StaleUploadHealthService } from "@/server/domain/files/stale-upload-health";
import { PrismaStaleUploadHealthRepository } from "@/server/repositories/prisma/stale-upload-health-repository";

let singleton: StaleUploadHealthService | null = null;

export function getStaleUploadHealthService() {
  if (singleton) return singleton;
  singleton = new StaleUploadHealthService(new PrismaStaleUploadHealthRepository());
  return singleton;
}

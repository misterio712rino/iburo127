import "server-only";

import { StoredFileScanHealthService } from "@/server/domain/files/scan-health";
import { PrismaStoredFileScanHealthRepository } from "@/server/repositories/prisma/file-scan-health-repository";

let singleton: StoredFileScanHealthService | null = null;

export function getStoredFileScanHealthService() {
  if (singleton) return singleton;
  singleton = new StoredFileScanHealthService(new PrismaStoredFileScanHealthRepository());
  return singleton;
}

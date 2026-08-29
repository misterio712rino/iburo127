import "server-only";

import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { StoredFileScanWorker } from "@/server/domain/files/scan-worker";
import { HttpMalwareScanner } from "@/server/files/http-malware-scanner";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaStoredFileRepository } from "@/server/repositories/prisma/stored-file-repository";

let singleton: StoredFileScanWorker | null = null;

export function getStoredFileScanWorker() {
  if (singleton) return singleton;
  const config = readMaintenanceRuntimeConfig();
  singleton = new StoredFileScanWorker(
    new PrismaStoredFileRepository(),
    getPrivateObjectStorage(),
    new HttpMalwareScanner(),
    {
      leaseSeconds: config.fileScanLeaseSeconds,
      sourceUrlTtlSeconds: config.fileScanSourceUrlTtlSeconds,
      maxAttempts: config.fileScanMaxAttempts,
      retryBaseSeconds: config.fileScanRetryBaseSeconds,
      retryMaxSeconds: config.fileScanRetryMaxSeconds,
    },
  );
  return singleton;
}

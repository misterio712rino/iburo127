import "server-only";

import {
  PRODUCTION_CONFIG_ERROR,
  readFileScannerRuntimeConfig,
  readMaintenanceRuntimeConfig,
} from "@/server/config/production";
import { StoredFileScanWorker } from "@/server/domain/files/scan-worker";
import { HttpMalwareScanner } from "@/server/files/http-malware-scanner";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaStoredFileRepository } from "@/server/repositories/prisma/stored-file-repository";

let singleton: StoredFileScanWorker | null = null;

export function getStoredFileScanWorker() {
  if (singleton) return singleton;
  const maintenance = readMaintenanceRuntimeConfig();
  const scanner = readFileScannerRuntimeConfig();
  if (scanner.requestTimeoutMs >= maintenance.fileScanLeaseSeconds * 1000) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_FILE_SCAN_LEASE_SECONDS`);
  }

  singleton = new StoredFileScanWorker(
    new PrismaStoredFileRepository(),
    getPrivateObjectStorage(),
    new HttpMalwareScanner(scanner),
    {
      leaseSeconds: maintenance.fileScanLeaseSeconds,
      sourceUrlTtlSeconds: maintenance.fileScanSourceUrlTtlSeconds,
      maxAttempts: maintenance.fileScanMaxAttempts,
      retryBaseSeconds: maintenance.fileScanRetryBaseSeconds,
      retryMaxSeconds: maintenance.fileScanRetryMaxSeconds,
    },
  );
  return singleton;
}

import "server-only";

import {
  PRODUCTION_CONFIG_ERROR,
  readMaintenanceRuntimeConfig,
} from "@/server/config/production";
import { DocumentProcessingWorker } from "@/server/domain/documents/processing-worker";
import {
  DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES,
  DOCUMENT_PROCESSOR_TIMEOUT_MS,
  DocumentProcessorClient,
  readDocumentProcessorConfig,
} from "@/server/files/document-processor-client";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaDocumentProcessingJobRepository } from "@/server/repositories/prisma/document-processing-job-repository";

let singleton: DocumentProcessingWorker | null = null;

export function getDocumentProcessingWorker() {
  if (singleton) return singleton;
  const maintenance = readMaintenanceRuntimeConfig();
  if (DOCUMENT_PROCESSOR_TIMEOUT_MS >= maintenance.documentProcessingLeaseSeconds * 1000) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_DOCUMENT_PROCESSING_LEASE_SECONDS`);
  }

  singleton = new DocumentProcessingWorker(
    new PrismaDocumentProcessingJobRepository(),
    getPrivateObjectStorage(),
    new DocumentProcessorClient(readDocumentProcessorConfig()),
    {
      leaseSeconds: maintenance.documentProcessingLeaseSeconds,
      maxAttempts: maintenance.documentProcessingMaxAttempts,
      retryBaseSeconds: maintenance.documentProcessingRetryBaseSeconds,
      retryMaxSeconds: maintenance.documentProcessingRetryMaxSeconds,
      maxUploadBytes: DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES,
    },
  );
  return singleton;
}

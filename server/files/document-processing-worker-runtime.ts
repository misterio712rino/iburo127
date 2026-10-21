import "server-only";

import { DocumentProcessingWorker } from "@/server/domain/documents/processing-worker";
import { readDocumentProcessingRuntimeConfig } from "@/server/config/document-processing-runtime";
import {
  DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES,
  DocumentProcessorClient,
  readDocumentProcessorConfig,
} from "@/server/files/document-processor-client";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import { PrismaDocumentProcessingJobRepository } from "@/server/repositories/prisma/document-processing-job-repository";

let singleton: DocumentProcessingWorker | null = null;

export function getDocumentProcessingWorker() {
  if (singleton) return singleton;
  const config = readDocumentProcessingRuntimeConfig();

  singleton = new DocumentProcessingWorker(
    new PrismaDocumentProcessingJobRepository(),
    getPrivateObjectStorage(),
    new DocumentProcessorClient(readDocumentProcessorConfig()),
    {
      ...config,
      maxUploadBytes: DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES,
    },
  );
  return singleton;
}

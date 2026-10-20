import "server-only";
import type { StoredFileStatus } from "@/server/domain/files/contracts";
import type { ExtractedDocumentText, DocumentProcessorClient } from "@/server/files/document-processor-client";
import { DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES } from "@/server/files/document-processor-client";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";

export const DOCUMENT_PROCESSING_INVALID_CONFIG = "DOCUMENT_PROCESSING_INVALID_CONFIG";
export const DOCUMENT_PROCESSING_SOURCE_NOT_READY = "DOCUMENT_PROCESSING_SOURCE_NOT_READY";
export const DOCUMENT_PROCESSING_STORAGE_PROVIDER_MISMATCH = "DOCUMENT_PROCESSING_STORAGE_PROVIDER_MISMATCH";
export const DOCUMENT_PROCESSING_INVALID_SOURCE = "DOCUMENT_PROCESSING_INVALID_SOURCE";
export const DOCUMENT_PROCESSING_FAILED = "DOCUMENT_PROCESSING_FAILED";

export type ClaimedDocumentProcessingJob = {
  id: string;
  clientCaseId: string;
  sourceFile: null | {
    id: string;
    clientCaseId: string;
    status: StoredFileStatus;
    storageProvider: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: bigint;
  };
  attemptCount: number;
  leaseToken: string;
};

export interface DocumentProcessingJobRepository {
  /** Claim atomically and only for a job whose source belongs to its case. */
  claimDue(input: { now: Date; leaseUntil: Date }): Promise<ClaimedDocumentProcessingJob | null>;
  /** Persist page text under the job's case and source-file scope. */
  complete(input: {
    jobId: string;
    leaseToken: string;
    completedAt: Date;
    pageTexts: readonly string[];
    pageCount: number;
  }): Promise<boolean>;
  reschedule(input: {
    jobId: string;
    leaseToken: string;
    nextAttemptAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  fail(input: {
    jobId: string;
    leaseToken: string;
    failedAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  cancel(input: {
    jobId: string;
    leaseToken: string;
    cancelledAt: Date;
    reasonCode: string;
  }): Promise<boolean>;
}

export type DocumentProcessingWorkerConfig = {
  leaseSeconds: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
  maxUploadBytes: number;
};

export type DocumentProcessingBatchResult = {
  claimed: number;
  completed: number;
  cancelled: number;
  retried: number;
  failed: number;
  leaseLost: number;
};

function requireIntegerInRange(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${DOCUMENT_PROCESSING_INVALID_CONFIG}:${label}`);
  }
}

export function assertDocumentProcessingWorkerConfig(config: DocumentProcessingWorkerConfig) {
  requireIntegerInRange(config.leaseSeconds, 30, 900, "leaseSeconds");
  requireIntegerInRange(config.maxAttempts, 1, 20, "maxAttempts");
  requireIntegerInRange(config.retryBaseSeconds, 10, 3600, "retryBaseSeconds");
  requireIntegerInRange(config.retryMaxSeconds, config.retryBaseSeconds, 86400, "retryMaxSeconds");
  requireIntegerInRange(config.maxUploadBytes, 1, DOCUMENT_PROCESSOR_MAX_UPLOAD_BYTES, "maxUploadBytes");
}

export function documentProcessingRetryDelaySeconds(attemptCount: number, baseSeconds: number, maxSeconds: number) {
  requireIntegerInRange(attemptCount, 1, 1000, "attemptCount");
  requireIntegerInRange(baseSeconds, 1, 86400, "baseSeconds");
  requireIntegerInRange(maxSeconds, baseSeconds, 86400, "maxSeconds");
  return Math.min(baseSeconds * (2 ** Math.min(attemptCount - 1, 20)), maxSeconds);
}

function safeProcessorErrorCode(error: unknown) {
  if (!(error instanceof Error)) return DOCUMENT_PROCESSING_FAILED;
  const match = /^(?:DOCUMENT_PROCESSOR_REQUEST_FAILED|DOCUMENT_PROCESSOR_INVALID_CONFIG):([A-Z0-9_:-]{1,80})$/.exec(error.message);
  return match?.[1] ?? DOCUMENT_PROCESSING_FAILED;
}

function isSupportedSource(file: NonNullable<ClaimedDocumentProcessingJob["sourceFile"]>, maxUploadBytes: number) {
  return file.sizeBytes > BigInt(0) && file.sizeBytes <= BigInt(maxUploadBytes) &&
    ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.mimeType);
}

/**
 * Processes OCR jobs only. The concrete repository must atomically gate claims on READY,
 * case/file ownership and the lease token. This worker checks READY again before reading.
 * It never logs or returns OCR text; persistence remains inside the repository boundary.
 */
export class DocumentProcessingWorker {
  constructor(
    private readonly repository: DocumentProcessingJobRepository,
    private readonly storage: PrivateObjectStorage,
    private readonly processor: Pick<DocumentProcessorClient, "extract">,
    private readonly config: DocumentProcessingWorkerConfig,
  ) {
    assertDocumentProcessingWorkerConfig(config);
  }

  private async processClaim(job: ClaimedDocumentProcessingJob, now: Date, result: DocumentProcessingBatchResult) {
    const file = job.sourceFile;
    if (!file || file.clientCaseId !== job.clientCaseId || file.status !== "READY") {
      const cancelled = await this.repository.cancel({
        jobId: job.id, leaseToken: job.leaseToken, cancelledAt: now,
        reasonCode: DOCUMENT_PROCESSING_SOURCE_NOT_READY,
      });
      if (cancelled) result.cancelled += 1;
      else result.leaseLost += 1;
      return;
    }
    if (file.storageProvider !== this.storage.providerCode) {
      const failed = await this.repository.fail({
        jobId: job.id, leaseToken: job.leaseToken, failedAt: now,
        errorCode: DOCUMENT_PROCESSING_STORAGE_PROVIDER_MISMATCH,
      });
      if (failed) result.failed += 1;
      else result.leaseLost += 1;
      return;
    }
    if (!isSupportedSource(file, this.config.maxUploadBytes)) {
      const failed = await this.repository.fail({
        jobId: job.id, leaseToken: job.leaseToken, failedAt: now,
        errorCode: DOCUMENT_PROCESSING_INVALID_SOURCE,
      });
      if (failed) result.failed += 1;
      else result.leaseLost += 1;
      return;
    }

    try {
      const bytes = await this.storage.readObject(file.objectKey, this.config.maxUploadBytes);
      if (bytes.byteLength !== Number(file.sizeBytes)) {
        throw new Error(`${DOCUMENT_PROCESSING_FAILED}:SOURCE_SIZE_MISMATCH`);
      }
      const extracted: ExtractedDocumentText = await this.processor.extract({ bytes, mimeType: file.mimeType });
      const completed = await this.repository.complete({
        jobId: job.id, leaseToken: job.leaseToken, completedAt: now,
        pageTexts: extracted.pageTexts, pageCount: extracted.pages,
      });
      if (completed) result.completed += 1;
      else result.leaseLost += 1;
    } catch (error) {
      const errorCode = safeProcessorErrorCode(error);
      if (job.attemptCount >= this.config.maxAttempts) {
        const failed = await this.repository.fail({
          jobId: job.id, leaseToken: job.leaseToken, failedAt: now, errorCode,
        });
        if (failed) result.failed += 1;
        else result.leaseLost += 1;
        return;
      }
      const delaySeconds = documentProcessingRetryDelaySeconds(
        job.attemptCount, this.config.retryBaseSeconds, this.config.retryMaxSeconds,
      );
      const retried = await this.repository.reschedule({
        jobId: job.id, leaseToken: job.leaseToken,
        nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000), errorCode,
      });
      if (retried) result.retried += 1;
      else result.leaseLost += 1;
    }
  }

  async runBatch(input: { now: Date; limit: number }): Promise<DocumentProcessingBatchResult> {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(`${DOCUMENT_PROCESSING_INVALID_CONFIG}:now`);
    }
    requireIntegerInRange(input.limit, 1, 100, "limit");
    const result: DocumentProcessingBatchResult = {
      claimed: 0, completed: 0, cancelled: 0, retried: 0, failed: 0, leaseLost: 0,
    };
    for (let index = 0; index < input.limit; index += 1) {
      const job = await this.repository.claimDue({
        now: input.now, leaseUntil: new Date(input.now.getTime() + this.config.leaseSeconds * 1000),
      });
      if (!job) break;
      result.claimed += 1;
      await this.processClaim(job, input.now, result);
    }
    return result;
  }
}

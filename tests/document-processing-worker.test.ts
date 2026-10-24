import assert from "node:assert/strict";
import type { StoredFileStatus } from "@/server/domain/files/contracts";
import {
  DOCUMENT_PROCESSING_SOURCE_NOT_READY,
  DOCUMENT_PROCESSING_STORAGE_PROVIDER_MISMATCH,
  DocumentProcessingWorker,
  documentProcessingRetryDelaySeconds,
  documentProcessingLeaseHeartbeatIntervalMs,
  type ClaimedDocumentProcessingJob,
  type DocumentProcessingJobRepository,
} from "@/server/domain/documents/processing-worker";
import type { PrivateObjectStorage } from "@/server/files/object-storage-contract";
import type { DocumentProcessorClient } from "@/server/files/document-processor-client";
import { readDocumentProcessingRuntimeConfig } from "@/server/config/document-processing-runtime";
import { UPLOAD_MIME_TYPES } from "@/lib/platform/files/upload-types";

const now = new Date("2026-10-20T06:00:00.000Z");
const bytes = new Uint8Array([1, 2, 3]);

function claimed(status: StoredFileStatus = "READY", attemptCount = 1): ClaimedDocumentProcessingJob {
  return {
    id: "job-1", clientCaseId: "case-1", attemptCount, leaseToken: "lease-1",
    sourceFile: {
      id: "file-1", clientCaseId: "case-1", status, storageProvider: "test-storage",
      objectKey: "case-1/private/file-1", mimeType: "application/pdf", sizeBytes: BigInt(3),
    },
  };
}

class FakeRepository implements DocumentProcessingJobRepository {
  claim: ClaimedDocumentProcessingJob | null = claimed();
  completedInput: Parameters<DocumentProcessingJobRepository["complete"]>[0] | null = null;
  rescheduledInput: Parameters<DocumentProcessingJobRepository["reschedule"]>[0] | null = null;
  failedInput: Parameters<DocumentProcessingJobRepository["fail"]>[0] | null = null;
  cancelledInput: Parameters<DocumentProcessingJobRepository["cancel"]>[0] | null = null;
  loseLease = false;
  completeError: Error | null = null;
  async claimDue() { const result = this.claim; this.claim = null; return result; }
  async extendLease() { return !this.loseLease; }
  async complete(input: Parameters<DocumentProcessingJobRepository["complete"]>[0]) {
    if (this.completeError) throw this.completeError;
    this.completedInput = input; return !this.loseLease;
  }
  async reschedule(input: Parameters<DocumentProcessingJobRepository["reschedule"]>[0]) {
    this.rescheduledInput = input; return !this.loseLease;
  }
  async fail(input: Parameters<DocumentProcessingJobRepository["fail"]>[0]) {
    this.failedInput = input; return !this.loseLease;
  }
  async cancel(input: Parameters<DocumentProcessingJobRepository["cancel"]>[0]) {
    this.cancelledInput = input; return !this.loseLease;
  }
}

class FakeStorage implements PrivateObjectStorage {
  providerCode = "test-storage";
  readCalls = 0;
  async createUploadUrl(): Promise<never> { throw new Error("unused"); }
  async createDownloadUrl(): Promise<never> { throw new Error("unused"); }
  async statObject(): Promise<null> { return null; }
  async readObject() { this.readCalls += 1; return bytes; }
  async deleteObject() { throw new Error("unused"); }
}

function makeWorker(repository: FakeRepository, storage = new FakeStorage(), extract: DocumentProcessorClient["extract"] = async () => ({
  text: "page 1", pageTexts: ["page 1"], pages: 1,
}), clock: () => Date = () => new Date(now.getTime() + 30_000)) {
  const processor = { extract };
  return new DocumentProcessingWorker(repository, storage, processor, {
    leaseSeconds: 120, maxAttempts: 3, retryBaseSeconds: 60, retryMaxSeconds: 300, maxUploadBytes: 50 * 1024 * 1024,
  }, clock);
}

async function testSuccessPersistsPageBoundariesWithoutReturningText() {
  const repo = new FakeRepository();
  const store = new FakeStorage();
  const result = await makeWorker(repo, store, async () => ({
    text: "joined", pageTexts: ["ФИО: Иванов Иван Иванович", "Дата рождения: 17.04.1990"], pages: 2,
  }))
    .runBatch({ now, limit: 4 });
  assert.deepEqual(result, { claimed: 1, completed: 1, cancelled: 0, retried: 0, failed: 0, leaseLost: 0 });
  assert.equal(store.readCalls, 1);
  assert.deepEqual(repo.completedInput?.pageTexts, ["ФИО: Иванов Иван Иванович", "Дата рождения: 17.04.1990"]);
  assert.equal(repo.completedInput?.completedAt.getTime(), now.getTime() + 30_000);
  assert.deepEqual(repo.completedInput?.factCandidates.map((candidate) => ({
    caseId: candidate.caseId, sourceFileId: candidate.sourceFileId,
    fieldPath: candidate.fieldPath, recordKey: candidate.recordKey, sourcePage: candidate.sourcePage,
  })), [
    { caseId: "case-1", sourceFileId: "file-1", fieldPath: "subject.fullName", recordKey: "default", sourcePage: 1 },
    { caseId: "case-1", sourceFileId: "file-1", fieldPath: "subject.birthDate", recordKey: "default", sourcePage: 2 },
  ]);
  assert.deepEqual(Object.keys(result), ["claimed", "completed", "cancelled", "retried", "failed", "leaseLost"]);
}

async function testEveryUploadMimeTypeCanReachTheProcessor() {
  for (const mimeType of UPLOAD_MIME_TYPES) {
    const repo = new FakeRepository();
    repo.claim = { ...claimed(), sourceFile: { ...claimed().sourceFile!, mimeType } };
    let processorCalls = 0;
    const result = await makeWorker(repo, new FakeStorage(), async () => {
      processorCalls += 1;
      return { text: "recognized", pageTexts: ["recognized"], pages: 1 };
    }).runBatch({ now, limit: 1 });
    assert.equal(result.completed, 1, mimeType);
    assert.equal(processorCalls, 1, mimeType);
  }
}

async function testNonReadySourceNeverReadsOrCallsProcessor() {
  const repo = new FakeRepository(); repo.claim = claimed("PENDING_SCAN");
  const store = new FakeStorage(); let processorCalls = 0;
  const result = await makeWorker(repo, store, async () => { processorCalls += 1; throw new Error("must not run"); })
    .runBatch({ now, limit: 1 });
  assert.equal(result.cancelled, 1);
  assert.equal(repo.cancelledInput?.reasonCode, DOCUMENT_PROCESSING_SOURCE_NOT_READY);
  assert.equal(store.readCalls, 0); assert.equal(processorCalls, 0);
}

async function testCaseMismatchIsCancelledBeforeRead() {
  const repo = new FakeRepository(); repo.claim = { ...claimed(), sourceFile: { ...claimed().sourceFile!, clientCaseId: "other-case" } };
  const store = new FakeStorage();
  const result = await makeWorker(repo, store).runBatch({ now, limit: 1 });
  assert.equal(result.cancelled, 1); assert.equal(store.readCalls, 0);
}

async function testProviderMismatchFailsClosed() {
  const repo = new FakeRepository(); const store = new FakeStorage(); store.providerCode = "other-storage";
  const result = await makeWorker(repo, store).runBatch({ now, limit: 1 });
  assert.equal(result.failed, 1);
  assert.equal(repo.failedInput?.errorCode, DOCUMENT_PROCESSING_STORAGE_PROVIDER_MISMATCH);
  assert.equal(store.readCalls, 0);
}

async function testTransientFailureRetriesWithSafeCode() {
  const repo = new FakeRepository();
  const result = await makeWorker(repo, new FakeStorage(), async () => {
    throw new Error("https://secret.example/file?token=private");
  }).runBatch({ now, limit: 1 });
  assert.equal(result.retried, 1);
  assert.equal(repo.rescheduledInput?.errorCode, "DOCUMENT_PROCESSING_FAILED");
  assert.equal(repo.rescheduledInput?.nextAttemptAt.getTime(), now.getTime() + 90_000);
  assert.doesNotMatch(repo.rescheduledInput?.errorCode ?? "", /secret|token/i);
}

async function testInvalidRepositoryOutputIsRetriedInsteadOfCountedAsLeaseLoss() {
  const repo = new FakeRepository();
  repo.completeError = new Error("DOCUMENT_PROCESSING_FAILED:INVALID_OCR_OUTPUT");
  const result = await makeWorker(repo).runBatch({ now, limit: 1 });
  assert.equal(result.retried, 1);
  assert.equal(result.leaseLost, 0);
  assert.equal(repo.rescheduledInput?.errorCode, "DOCUMENT_PROCESSING_FAILED");
}

async function testAttemptsExhaustIntoFailureAndLeaseLossIsNotCountedAsSuccess() {
  const repo = new FakeRepository(); repo.claim = claimed("READY", 3);
  const result = await makeWorker(repo, new FakeStorage(), async () => { throw new Error("fail"); })
    .runBatch({ now, limit: 1 });
  assert.equal(result.failed, 1); assert.equal(repo.rescheduledInput, null);
  const lost = new FakeRepository(); lost.loseLease = true;
  const lostResult = await makeWorker(lost).runBatch({ now, limit: 1 });
  assert.equal(lostResult.completed, 0); assert.equal(lostResult.leaseLost, 1);
}

assert.equal(documentProcessingRetryDelaySeconds(3, 60, 300), 240);
assert.equal(documentProcessingLeaseHeartbeatIntervalMs(120), 40_000);
assert.equal(documentProcessingLeaseHeartbeatIntervalMs(30), 10_000);
assert.deepEqual(readDocumentProcessingRuntimeConfig({}), {
  leaseSeconds: 120, maxAttempts: 3, retryBaseSeconds: 60, retryMaxSeconds: 3_600,
});
assert.throws(() => readDocumentProcessingRuntimeConfig({ IB_DOCUMENT_PROCESSING_LEASE_SECONDS: "30" }), /PRODUCTION_CONFIG_ERROR/);
await testSuccessPersistsPageBoundariesWithoutReturningText();
await testEveryUploadMimeTypeCanReachTheProcessor();
await testNonReadySourceNeverReadsOrCallsProcessor();
await testCaseMismatchIsCancelledBeforeRead();
await testProviderMismatchFailsClosed();
await testTransientFailureRetriesWithSafeCode();
await testInvalidRepositoryOutputIsRetriedInsteadOfCountedAsLeaseLoss();
await testAttemptsExhaustIntoFailureAndLeaseLossIsNotCountedAsSuccess();
console.log("Document processing worker tests passed");

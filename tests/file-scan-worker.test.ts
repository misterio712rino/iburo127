import assert from "node:assert/strict";
import type {
  ClaimedStoredFileScan,
  StoredFileRecord,
  StoredFileRepository,
} from "@/server/domain/files/contracts";
import type {
  ClaimedStoredFileDeletion,
  StoredFileDeletionRecord,
  StoredFileDeletionRepository,
} from "@/server/domain/files/deletion-contracts";
import {
  FILE_DELETION_STORAGE_ERROR,
  FILE_DELETION_STORAGE_PROVIDER_MISMATCH,
  FileDeletionStorageError,
  StoredFileDeletionWorker,
  fileDeletionRetryDelaySeconds,
  type FileDeletionObjectStorage,
} from "@/server/domain/files/deletion-worker";
import {
  FILE_SCAN_SCANNER_ERROR,
  FILE_SCAN_STORAGE_PROVIDER_MISMATCH,
  MalwareScannerError,
  StoredFileScanWorker,
  fileScanRetryDelaySeconds,
  type MalwareScanner,
  type MalwareScanObjectStorage,
} from "@/server/domain/files/scan-worker";

const now = new Date("2026-08-29T00:00:00.000Z");

function claimedFile(attemptCount = 1): ClaimedStoredFileScan {
  return {
    id: "file-1",
    clientCaseId: "case-1",
    uploadedById: "user-1",
    status: "SCANNING",
    storageProvider: "yandex-object-storage",
    objectKey: "cases/case-1/file-1/object.pdf",
    fileName: "document.pdf",
    mimeType: "application/pdf",
    sizeBytes: BigInt(1024),
    checksumSha256: null,
    scanAttemptCount: attemptCount,
    scanNextAttemptAt: now,
    scanLeaseUntil: new Date(now.getTime() + 120_000),
    scanLeaseToken: "00000000-0000-4000-8000-000000000001",
    scanProvider: null,
    scanLastErrorCode: null,
    scannedAt: null,
    quarantinedAt: null,
    readyAt: null,
    createdAt: now,
  };
}

class FakeRepository implements StoredFileRepository {
  claim: ClaimedStoredFileScan | null;
  cleanInput: Parameters<StoredFileRepository["markScanClean"]>[0] | null = null;
  quarantinedInput: Parameters<StoredFileRepository["markScanQuarantined"]>[0] | null = null;
  retryInput: Parameters<StoredFileRepository["rescheduleScan"]>[0] | null = null;
  failedInput: Parameters<StoredFileRepository["markScanFailed"]>[0] | null = null;
  loseLease = false;

  constructor(claim = claimedFile()) {
    this.claim = claim;
  }

  async claimDueScan() {
    const value = this.claim;
    this.claim = null;
    return value;
  }

  async markScanClean(input: Parameters<StoredFileRepository["markScanClean"]>[0]) {
    this.cleanInput = input;
    return this.loseLease
      ? null
      : ({ ...claimedFile(), status: "READY", readyAt: input.scannedAt } as StoredFileRecord);
  }

  async markScanQuarantined(input: Parameters<StoredFileRepository["markScanQuarantined"]>[0]) {
    this.quarantinedInput = input;
    return this.loseLease
      ? null
      : ({
          ...claimedFile(),
          status: "QUARANTINED",
          quarantinedAt: input.scannedAt,
        } as StoredFileRecord);
  }

  async rescheduleScan(input: Parameters<StoredFileRepository["rescheduleScan"]>[0]) {
    this.retryInput = input;
    return !this.loseLease;
  }

  async markScanFailed(input: Parameters<StoredFileRepository["markScanFailed"]>[0]) {
    this.failedInput = input;
    return !this.loseLease;
  }

  async listByCase() {
    return [];
  }
  async getById() {
    return null;
  }
  async listPendingBefore() {
    return [];
  }
  async create(input: Parameters<StoredFileRepository["create"]>[0]): Promise<StoredFileRecord> {
    void input;
    throw new Error("unused");
  }
  async markPendingScan() {
    return null;
  }
  async deletePending() {
    return false;
  }
  async restorePending() {
    return false;
  }
}

class FakeStorage implements MalwareScanObjectStorage {
  readonly providerCode = "yandex-object-storage";
  calls = 0;

  async createDownloadUrl(input: { objectKey: string; expiresInSeconds: number }) {
    this.calls += 1;
    assert.equal(input.objectKey, "cases/case-1/file-1/object.pdf");
    assert.equal(input.expiresInSeconds, 180);
    return {
      url: "https://storage.yandexcloud.net/bucket/object?X-Amz-Signature=abc",
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000),
    };
  }
}

function worker(
  repository: FakeRepository,
  scanner: MalwareScanner,
  storage: MalwareScanObjectStorage = new FakeStorage(),
) {
  return new StoredFileScanWorker(repository, storage, scanner, {
    leaseSeconds: 120,
    sourceUrlTtlSeconds: 180,
    maxAttempts: 3,
    retryBaseSeconds: 60,
    retryMaxSeconds: 300,
  });
}

async function testClean() {
  const repository = new FakeRepository();
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan(input) {
      assert.equal(input.mimeType, "application/pdf");
      assert.equal(input.sizeBytes, BigInt(1024));
      assert.match(input.sourceUrl, /X-Amz-Signature=/);
      return { verdict: "CLEAN" };
    },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 5 });
  assert.deepEqual(result, {
    claimed: 1,
    clean: 1,
    quarantined: 0,
    retried: 0,
    failed: 0,
    leaseLost: 0,
  });
  assert.equal(repository.cleanInput?.providerCode, "scanner-test");
}

async function testMalicious() {
  const repository = new FakeRepository();
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() {
      return { verdict: "MALICIOUS" };
    },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(result.quarantined, 1);
  assert.equal(repository.quarantinedInput?.providerCode, "scanner-test");
  assert.equal(repository.cleanInput, null);
}

async function testRetry() {
  const repository = new FakeRepository(claimedFile(2));
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() {
      throw new MalwareScannerError("SCANNER_HTTP_5XX");
    },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(result.retried, 1);
  assert.equal(repository.retryInput?.errorCode, "SCANNER_HTTP_5XX");
  assert.equal(repository.retryInput?.nextAttemptAt.getTime(), now.getTime() + 120_000);
}

async function testUnknownErrorIsNormalized() {
  const repository = new FakeRepository();
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() {
      throw new Error("https://secret.example/?token=do-not-store");
    },
  };
  await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(repository.retryInput?.errorCode, FILE_SCAN_SCANNER_ERROR);
  assert.doesNotMatch(repository.retryInput?.errorCode ?? "", /secret|token/i);
}

async function testTerminalFailure() {
  const repository = new FakeRepository(claimedFile(3));
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() {
      throw new MalwareScannerError("SCANNER_TIMEOUT");
    },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(result.failed, 1);
  assert.equal(repository.failedInput?.errorCode, "SCANNER_TIMEOUT");
  assert.equal(repository.retryInput, null);
}

async function testStorageMismatchFailsClosed() {
  const repository = new FakeRepository();
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() {
      throw new Error("must not run");
    },
  };
  const storage: MalwareScanObjectStorage = {
    providerCode: "different-storage",
    async createDownloadUrl() {
      throw new Error("must not run");
    },
  };
  const result = await worker(repository, scanner, storage).runBatch({ now, limit: 1 });
  assert.equal(result.failed, 1);
  assert.equal(repository.failedInput?.errorCode, FILE_SCAN_STORAGE_PROVIDER_MISMATCH);
}

async function testLeaseLossNeverCountsReady() {
  const repository = new FakeRepository();
  repository.loseLease = true;
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() {
      return { verdict: "CLEAN" };
    },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(result.clean, 0);
  assert.equal(result.leaseLost, 1);
}

function claimedDeletion(attemptCount = 1): ClaimedStoredFileDeletion {
  return {
    fileId: "delete-file-1",
    clientCaseId: "case-1",
    requestedByUserId: "user-1",
    storageProvider: "yandex-object-storage",
    objectKey: "cases/case-1/delete-file-1/object.pdf",
    originalFileStatus: "READY",
    status: "PROCESSING",
    attemptCount,
    nextAttemptAt: null,
    leaseUntil: new Date(now.getTime() + 120_000),
    leaseToken: "00000000-0000-4000-8000-000000000099",
    lastErrorCode: null,
    requestedAt: now,
    storageConfirmedAt: null,
    completedAt: null,
    completionActivityEventId: null,
    createdAt: now,
    updatedAt: now,
  };
}

class FakeDeletionRepository implements StoredFileDeletionRepository {
  claim: ClaimedStoredFileDeletion | null;
  retryInput: Parameters<StoredFileDeletionRepository["rescheduleDeletion"]>[0] | null = null;
  attentionInput: Parameters<
    StoredFileDeletionRepository["markDeletionRequiresAttention"]
  >[0] | null = null;
  finalizeInput: Parameters<StoredFileDeletionRepository["finalizeDeletion"]>[0] | null = null;
  loseLease = false;
  throwOnFinalize = false;

  constructor(claim = claimedDeletion()) {
    this.claim = claim;
  }

  async getByFileId(): Promise<StoredFileDeletionRecord | null> {
    return this.claim;
  }

  async claimDueDeletion() {
    const value = this.claim;
    this.claim = null;
    return value;
  }

  async rescheduleDeletion(
    input: Parameters<StoredFileDeletionRepository["rescheduleDeletion"]>[0],
  ) {
    this.retryInput = input;
    return !this.loseLease;
  }

  async markDeletionRequiresAttention(
    input: Parameters<StoredFileDeletionRepository["markDeletionRequiresAttention"]>[0],
  ) {
    this.attentionInput = input;
    return !this.loseLease;
  }

  async finalizeDeletion(
    input: Parameters<StoredFileDeletionRepository["finalizeDeletion"]>[0],
  ) {
    this.finalizeInput = input;
    if (this.throwOnFinalize) throw new Error("database unavailable");
    return !this.loseLease;
  }
}

class FakeDeletionStorage implements FileDeletionObjectStorage {
  readonly providerCode = "yandex-object-storage";
  calls = 0;
  error: Error | null = null;

  async deleteObject(objectKey: string) {
    this.calls += 1;
    assert.equal(objectKey, "cases/case-1/delete-file-1/object.pdf");
    if (this.error) throw this.error;
  }
}

function deletionWorker(
  repository: FakeDeletionRepository,
  storage: FileDeletionObjectStorage = new FakeDeletionStorage(),
) {
  return new StoredFileDeletionWorker(repository, storage, {
    leaseSeconds: 120,
    maxAttempts: 3,
    retryBaseSeconds: 60,
    retryMaxSeconds: 300,
  });
}

async function testDeletionCompletesAfterStorageConfirmation() {
  const repository = new FakeDeletionRepository();
  const storage = new FakeDeletionStorage();
  const result = await deletionWorker(repository, storage).runBatch({ now, limit: 5 });
  assert.deepEqual(result, {
    claimed: 1,
    completed: 1,
    retried: 0,
    requiresAttention: 0,
    leaseLost: 0,
    finalizationDeferred: 0,
  });
  assert.equal(storage.calls, 1);
  assert.equal(repository.finalizeInput?.leaseToken, claimedDeletion().leaseToken);
  assert.equal(repository.finalizeInput?.storageConfirmedAt, now);
}

async function testDeletionRetryAndErrorRedaction() {
  const repository = new FakeDeletionRepository(claimedDeletion(2));
  const storage = new FakeDeletionStorage();
  storage.error = new Error("https://storage.example/?secret=do-not-store");
  const result = await deletionWorker(repository, storage).runBatch({ now, limit: 1 });
  assert.equal(result.retried, 1);
  assert.equal(repository.retryInput?.errorCode, FILE_DELETION_STORAGE_ERROR);
  assert.equal(repository.retryInput?.nextAttemptAt.getTime(), now.getTime() + 120_000);
  assert.doesNotMatch(repository.retryInput?.errorCode ?? "", /secret|storage\.example/i);
  assert.equal(repository.finalizeInput, null);
}

async function testDeletionSafeProviderErrorCode() {
  const repository = new FakeDeletionRepository();
  const storage = new FakeDeletionStorage();
  storage.error = new FileDeletionStorageError("OBJECT_DELETE_TIMEOUT");
  await deletionWorker(repository, storage).runBatch({ now, limit: 1 });
  assert.equal(repository.retryInput?.errorCode, "OBJECT_DELETE_TIMEOUT");
}

async function testDeletionTerminalFailureRequiresAttention() {
  const repository = new FakeDeletionRepository(claimedDeletion(3));
  const storage = new FakeDeletionStorage();
  storage.error = new FileDeletionStorageError("OBJECT_DELETE_TIMEOUT");
  const result = await deletionWorker(repository, storage).runBatch({ now, limit: 1 });
  assert.equal(result.requiresAttention, 1);
  assert.equal(repository.attentionInput?.errorCode, "OBJECT_DELETE_TIMEOUT");
  assert.equal(repository.retryInput, null);
  assert.equal(repository.finalizeInput, null);
}

async function testDeletionStorageMismatchFailsClosed() {
  const repository = new FakeDeletionRepository();
  const storage: FileDeletionObjectStorage = {
    providerCode: "different-storage",
    async deleteObject() {
      throw new Error("must not run");
    },
  };
  const result = await deletionWorker(repository, storage).runBatch({ now, limit: 1 });
  assert.equal(result.requiresAttention, 1);
  assert.equal(
    repository.attentionInput?.errorCode,
    FILE_DELETION_STORAGE_PROVIDER_MISMATCH,
  );
  assert.equal(repository.finalizeInput, null);
}

async function testDeletionLostLeaseNeverCountsComplete() {
  const repository = new FakeDeletionRepository();
  repository.loseLease = true;
  const result = await deletionWorker(repository).runBatch({ now, limit: 1 });
  assert.equal(result.completed, 0);
  assert.equal(result.leaseLost, 1);
}

async function testDeletionFinalizationFailureRemainsRecoverable() {
  const repository = new FakeDeletionRepository();
  repository.throwOnFinalize = true;
  const result = await deletionWorker(repository).runBatch({ now, limit: 1 });
  assert.equal(result.completed, 0);
  assert.equal(result.finalizationDeferred, 1);
  assert.equal(repository.retryInput, null);
  assert.equal(repository.attentionInput, null);
  assert.ok(repository.finalizeInput, "worker must attempt finalization after storage success");
}

assert.equal(fileScanRetryDelaySeconds(1, 60, 300), 60);
assert.equal(fileScanRetryDelaySeconds(2, 60, 300), 120);
assert.equal(fileScanRetryDelaySeconds(4, 60, 300), 300);
assert.throws(
  () =>
    new StoredFileScanWorker(
      new FakeRepository(),
      new FakeStorage(),
      {
        providerCode: "scanner-test",
        async scan() {
          return { verdict: "CLEAN" };
        },
      },
      {
        leaseSeconds: 120,
        sourceUrlTtlSeconds: 60,
        maxAttempts: 3,
        retryBaseSeconds: 60,
        retryMaxSeconds: 300,
      },
    ),
  /FILE_SCAN_INVALID_CONFIG/,
);

assert.equal(fileDeletionRetryDelaySeconds(1, 60, 300), 60);
assert.equal(fileDeletionRetryDelaySeconds(2, 60, 300), 120);
assert.equal(fileDeletionRetryDelaySeconds(4, 60, 300), 300);
assert.throws(
  () =>
    new StoredFileDeletionWorker(new FakeDeletionRepository(), new FakeDeletionStorage(), {
      leaseSeconds: 10,
      maxAttempts: 3,
      retryBaseSeconds: 60,
      retryMaxSeconds: 300,
    }),
  /FILE_DELETION_INVALID_CONFIG/,
);

await testClean();
await testMalicious();
await testRetry();
await testUnknownErrorIsNormalized();
await testTerminalFailure();
await testStorageMismatchFailsClosed();
await testLeaseLossNeverCountsReady();
await testDeletionCompletesAfterStorageConfirmation();
await testDeletionRetryAndErrorRedaction();
await testDeletionSafeProviderErrorCode();
await testDeletionTerminalFailureRequiresAttention();
await testDeletionStorageMismatchFailsClosed();
await testDeletionLostLeaseNeverCountsComplete();
await testDeletionFinalizationFailureRemainsRecoverable();

console.log("file scan and deletion worker tests: PASS");

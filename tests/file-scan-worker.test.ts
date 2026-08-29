import assert from "node:assert/strict";
import type {
  ClaimedStoredFileScan,
  StoredFileRecord,
  StoredFileRepository,
} from "@/server/domain/files/contracts";
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
    return this.loseLease ? null : ({ ...claimedFile(), status: "READY", readyAt: input.scannedAt } as StoredFileRecord);
  }

  async markScanQuarantined(input: Parameters<StoredFileRepository["markScanQuarantined"]>[0]) {
    this.quarantinedInput = input;
    return this.loseLease
      ? null
      : ({ ...claimedFile(), status: "QUARANTINED", quarantinedAt: input.scannedAt } as StoredFileRecord);
  }

  async rescheduleScan(input: Parameters<StoredFileRepository["rescheduleScan"]>[0]) {
    this.retryInput = input;
    return !this.loseLease;
  }

  async markScanFailed(input: Parameters<StoredFileRepository["markScanFailed"]>[0]) {
    this.failedInput = input;
    return !this.loseLease;
  }

  async listByCase() { return []; }
  async getById() { return null; }
  async listPendingBefore() { return []; }
  async create(
    input: Parameters<StoredFileRepository["create"]>[0],
  ): Promise<StoredFileRecord> {
    void input;
    throw new Error("unused");
  }
  async markPendingScan() { return null; }
  async deletePending() { return false; }
  async restorePending() { return false; }
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
    async scan() { return { verdict: "MALICIOUS" }; },
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
    async scan() { throw new MalwareScannerError("SCANNER_HTTP_5XX"); },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(result.retried, 1);
  assert.equal(repository.retryInput?.errorCode, "SCANNER_HTTP_5XX");
  assert.equal(
    repository.retryInput?.nextAttemptAt.getTime(),
    now.getTime() + 120_000,
  );
}

async function testUnknownErrorIsNormalized() {
  const repository = new FakeRepository();
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() { throw new Error("https://secret.example/?token=do-not-store"); },
  };
  await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(repository.retryInput?.errorCode, FILE_SCAN_SCANNER_ERROR);
  assert.doesNotMatch(repository.retryInput?.errorCode ?? "", /secret|token/i);
}

async function testTerminalFailure() {
  const repository = new FakeRepository(claimedFile(3));
  const scanner: MalwareScanner = {
    providerCode: "scanner-test",
    async scan() { throw new MalwareScannerError("SCANNER_TIMEOUT"); },
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
    async scan() { throw new Error("must not run"); },
  };
  const storage: MalwareScanObjectStorage = {
    providerCode: "different-storage",
    async createDownloadUrl() { throw new Error("must not run"); },
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
    async scan() { return { verdict: "CLEAN" }; },
  };
  const result = await worker(repository, scanner).runBatch({ now, limit: 1 });
  assert.equal(result.clean, 0);
  assert.equal(result.leaseLost, 1);
}

assert.equal(fileScanRetryDelaySeconds(1, 60, 300), 60);
assert.equal(fileScanRetryDelaySeconds(2, 60, 300), 120);
assert.equal(fileScanRetryDelaySeconds(4, 60, 300), 300);
assert.throws(
  () => new StoredFileScanWorker(new FakeRepository(), new FakeStorage(), {
    providerCode: "scanner-test",
    async scan() { return { verdict: "CLEAN" }; },
  }, {
    leaseSeconds: 120,
    sourceUrlTtlSeconds: 60,
    maxAttempts: 3,
    retryBaseSeconds: 60,
    retryMaxSeconds: 300,
  }),
  /FILE_SCAN_INVALID_CONFIG/,
);

await testClean();
await testMalicious();
await testRetry();
await testUnknownErrorIsNormalized();
await testTerminalFailure();
await testStorageMismatchFailsClosed();
await testLeaseLossNeverCountsReady();

console.log("file scan worker tests: PASS");

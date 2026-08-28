import assert from "node:assert/strict";
import type {
  StoredFileRecord,
  StoredFileRepository,
  StoredFileStatus,
} from "@/server/domain/files/contracts";
import type {
  CreateDownloadUrlInput,
  CreateUploadUrlInput,
  PrivateObjectStorage,
} from "@/server/files/object-storage-contract";
import { PendingUploadCleanupService } from "@/server/files/pending-upload-cleanup";

const createdAt = new Date("2026-08-28T00:00:00.000Z");
const staleFile: StoredFileRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  clientCaseId: "22222222-2222-4222-8222-222222222222",
  uploadedById: "33333333-3333-4333-8333-333333333333",
  status: "PENDING_UPLOAD",
  storageProvider: "yandex-object-storage",
  objectKey: "cases/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/object.pdf",
  fileName: "document.pdf",
  mimeType: "application/pdf",
  sizeBytes: BigInt(1024),
  checksumSha256: null,
  readyAt: null,
  createdAt,
};

class FakeRepository implements StoredFileRepository {
  current: StoredFileRecord | null = { ...staleFile };
  promoteBeforeClaim = false;
  restoreCalls = 0;

  async listByCase() {
    return [];
  }

  async getById(fileId: string) {
    return this.current?.id === fileId ? this.current : null;
  }

  async listPendingBefore(before: Date, limit: number) {
    return this.current?.status === "PENDING_UPLOAD" && this.current.createdAt < before && limit > 0
      ? [{ ...this.current }]
      : [];
  }

  async create(input: {
    id: string;
    clientCaseId: string;
    uploadedById: string | null;
    status: StoredFileStatus;
    storageProvider: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    checksumSha256?: string | null;
  }) {
    this.current = {
      ...input,
      checksumSha256: input.checksumSha256 ?? null,
      readyAt: null,
      createdAt,
    };
    return this.current;
  }

  async markReady(fileId: string, readyAt: Date) {
    assert.equal(this.current?.id, fileId);
    this.current = { ...this.current!, status: "READY", readyAt };
    return this.current;
  }

  async deletePending(fileId: string) {
    if (this.promoteBeforeClaim && this.current?.id === fileId) {
      this.current = { ...this.current, status: "READY", readyAt: new Date() };
    }
    if (this.current?.id !== fileId || this.current.status !== "PENDING_UPLOAD") return false;
    this.current = null;
    return true;
  }

  async restorePending(file: StoredFileRecord) {
    this.restoreCalls += 1;
    if (this.current) return false;
    this.current = { ...file };
    return true;
  }
}

class FakeStorage implements PrivateObjectStorage {
  readonly providerCode = "yandex-object-storage";
  deleteCalls = 0;
  failDelete = false;

  async createUploadUrl(_input: CreateUploadUrlInput) {
    void _input;
    return { url: "https://example.invalid/upload", expiresAt: new Date() };
  }

  async createDownloadUrl(_input: CreateDownloadUrlInput) {
    void _input;
    return { url: "https://example.invalid/download", expiresAt: new Date() };
  }

  async statObject() {
    return null;
  }

  async deleteObject() {
    this.deleteCalls += 1;
    if (this.failDelete) throw new Error("simulated storage failure");
  }
}

async function successfulCleanup() {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const service = new PendingUploadCleanupService(repository, storage);
  const result = await service.cleanup({ before: new Date("2026-08-28T02:00:00.000Z") });

  assert.deepEqual(result, { inspected: 1, deleted: 1, skipped: 0, failed: 0 });
  assert.equal(repository.current, null);
  assert.equal(storage.deleteCalls, 1);
}

async function readyRaceIsProtected() {
  const repository = new FakeRepository();
  repository.promoteBeforeClaim = true;
  const storage = new FakeStorage();
  const service = new PendingUploadCleanupService(repository, storage);
  const result = await service.cleanup({ before: new Date("2026-08-28T02:00:00.000Z") });

  assert.deepEqual(result, { inspected: 1, deleted: 0, skipped: 1, failed: 0 });
  assert.equal(repository.current?.status, "READY");
  assert.equal(storage.deleteCalls, 0);
}

async function storageFailureRestoresClaim() {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  storage.failDelete = true;
  const service = new PendingUploadCleanupService(repository, storage);
  const result = await service.cleanup({ before: new Date("2026-08-28T02:00:00.000Z") });

  assert.deepEqual(result, { inspected: 1, deleted: 0, skipped: 0, failed: 1 });
  assert.equal(repository.restoreCalls, 1);
  assert.equal(repository.current?.status, "PENDING_UPLOAD");
  assert.equal(repository.current?.id, staleFile.id);
}

await successfulCleanup();
await readyRaceIsProtected();
await storageFailureRestoresClaim();

console.log("pending upload cleanup tests: PASS");

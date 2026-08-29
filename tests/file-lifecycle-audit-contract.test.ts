import assert from "node:assert/strict";
import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  StoredFileRecord,
  StoredFileRepository,
  StoredFileStatus,
} from "@/server/domain/files/contracts";
import { StoredFileService } from "@/server/domain/files/service";
import { requireCaseActivityType } from "@/server/domain/activity/taxonomy";

const now = new Date("2026-08-28T00:00:00.000Z");
const actor: AuthenticatedActor = { userId: "client-1", roles: ["CLIENT"] };
const clientCase: ClientCaseRecord = {
  id: "case-1",
  caseNumber: "IBR-2026-000001",
  clientId: actor.userId,
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: null,
  status: "ACTIVE",
};

class CaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    return scope.actor.userId === actor.userId && scope.caseId === clientCase.id ? clientCase : null;
  }

  async listAccessibleCases() {
    return [clientCase];
  }
}

class FileRepository implements StoredFileRepository {
  current: StoredFileRecord | null = null;
  losePendingRace = false;
  lastAuditActorUserId: string | null = null;

  async listByCase() {
    return this.current?.status === "READY" ? [this.current] : [];
  }

  async getById(fileId: string) {
    return this.current?.id === fileId ? this.current : null;
  }

  async listPendingBefore() {
    return [];
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
      scanAttemptCount: 0,
      scanNextAttemptAt: null,
      scanLeaseUntil: null,
      scanLeaseToken: null,
      scanProvider: null,
      scanLastErrorCode: null,
      scannedAt: null,
      quarantinedAt: null,
      readyAt: null,
      createdAt: now,
    };
    return this.current;
  }

  async markPendingScan(fileId: string, scanNextAttemptAt: Date, auditActorUserId: string) {
    this.lastAuditActorUserId = auditActorUserId;
    if (
      this.losePendingRace ||
      !this.current ||
      this.current.id !== fileId ||
      this.current.status !== "PENDING_UPLOAD" ||
      this.current.uploadedById !== auditActorUserId
    ) {
      return null;
    }
    this.current = {
      ...this.current,
      status: "PENDING_SCAN",
      scanNextAttemptAt,
      readyAt: null,
    };
    return this.current;
  }

  async claimDueScan() {
    return null;
  }

  async markScanClean() {
    return null;
  }

  async markScanQuarantined() {
    return null;
  }

  async rescheduleScan() {
    return false;
  }

  async markScanFailed() {
    return false;
  }

  async deletePending() {
    return false;
  }

  async restorePending() {
    return false;
  }
}

assert.equal(requireCaseActivityType("file.upload.completed"), "file.upload.completed");
assert.equal(requireCaseActivityType("file.scan.clean"), "file.scan.clean");
assert.equal(requireCaseActivityType("file.scan.quarantined"), "file.scan.quarantined");
assert.equal(requireCaseActivityType("file.scan.failed"), "file.scan.failed");

const repository = new FileRepository();
const service = new StoredFileService(new ClientCaseService(new CaseRepository()), repository);

const pending = await service.registerPendingUpload(actor, {
  id: "file-1",
  clientCaseId: clientCase.id,
  storageProvider: "yandex-object-storage",
  objectKey: "cases/case-1/file-1/object.pdf",
  fileName: "document.pdf",
  mimeType: "application/pdf",
  sizeBytes: BigInt(1024),
});
assert.equal(pending.status, "PENDING_UPLOAD");

const pendingScan = await service.markUploadPendingScan(actor, pending.id, now);
assert.equal(pendingScan.status, "PENDING_SCAN");
assert.equal(pendingScan.readyAt, null);
assert.equal(repository.lastAuditActorUserId, actor.userId);
await assert.rejects(service.get(actor, pending.id), /FILE_NOT_FOUND/);

await service.registerPendingUpload(actor, {
  id: "file-2",
  clientCaseId: clientCase.id,
  storageProvider: "yandex-object-storage",
  objectKey: "cases/case-1/file-2/object.pdf",
  fileName: "document-2.pdf",
  mimeType: "application/pdf",
  sizeBytes: BigInt(2048),
});
repository.losePendingRace = true;
await assert.rejects(
  service.markUploadPendingScan(actor, "file-2", now),
  /FILE_UPLOAD_NOT_PENDING/,
);

console.log("FILE_LIFECYCLE_AUDIT_CONTRACT_PASS");

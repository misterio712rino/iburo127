import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
const manager: AuthenticatedActor = { userId: "manager-1", roles: ["MANAGER"] };
const lawyer: AuthenticatedActor = { userId: "lawyer-1", roles: ["LAWYER"] };
const mixedRoleStaffActor: AuthenticatedActor = {
  userId: "mixed-role-1",
  roles: ["CLIENT", "MANAGER"],
};
const clientCase: ClientCaseRecord = {
  id: "case-1",
  caseNumber: "IBR-2026-000001",
  clientId: actor.userId,
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: lawyer.userId,
  status: "ACTIVE",
};

class CaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    if (scope.caseId !== clientCase.id) return null;
    if (scope.actor.userId === actor.userId) return clientCase;
    if (scope.actor.roles.includes("MANAGER")) return clientCase;
    if (scope.actor.roles.includes("LAWYER") && scope.actor.userId === clientCase.assignedLawyerId) {
      return clientCase;
    }
    return null;
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
    return this.current ? [this.current] : [];
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

const [
  nextConfigSource,
  productionFilesSource,
  clientFilesSource,
  storedFileRepositorySource,
  vercelBlobSignerSource,
] = await Promise.all([
  readFile(resolve("next.config.ts"), "utf8"),
  readFile(resolve("components/platform/files/ProductionFiles.tsx"), "utf8"),
  readFile(resolve("components/platform/files/IBuroFilesV2.tsx"), "utf8"),
  readFile(resolve("server/repositories/prisma/stored-file-repository.ts"), "utf8"),
  readFile(resolve("server/files/vercel-blob-native-signed-url.ts"), "utf8"),
]);
assert.match(
  productionFilesSource,
  /fetch\(prepared\.data\.uploadUrl/,
  "CLIENT file upload must remain a direct browser request to the prepared signed URL",
);
assert.match(
  clientFilesSource,
  /label: "На проверке"/,
  "CLIENT files UI must surface completed uploads while security scan is pending",
);
assert.match(
  clientFilesSource,
  /file\.status === "READY"/,
  "CLIENT files UI must keep downloads gated on READY status",
);
assert.doesNotMatch(
  storedFileRepositorySource,
  /where: \{ clientCaseId, status: "READY" \}/,
  "repository must return scan states so domain visibility policy can show the uploader their pending file",
);
assert.match(
  vercelBlobSignerSource,
  /const BLOB_API_URL = "https:\/\/vercel\.com\/api\/blob"/,
  "native private Blob PUT signing must remain pinned to the Vercel Blob API origin",
);
assert.match(
  nextConfigSource,
  /connect-src 'self' https:\/\/storage\.yandexcloud\.net https:\/\/vercel\.com/,
  "portal CSP must allow the exact Vercel Blob browser upload origin",
);
assert.match(
  nextConfigSource,
  /Strict-Transport-Security", value: "max-age=31536000"/,
  "protected application surfaces must retain HSTS",
);
assert.doesNotMatch(
  nextConfigSource,
  /connect-src[^\n]*\shttps:\s/,
  "CSP must not broaden browser connections to arbitrary HTTPS origins",
);

const repository = new FileRepository();
const service = new StoredFileService(new ClientCaseService(new CaseRepository()), repository);

for (const staffActor of [manager, lawyer, mixedRoleStaffActor]) {
  await assert.rejects(
    service.registerPendingUpload(staffActor, {
      id: `staff-file-${staffActor.userId}`,
      clientCaseId: clientCase.id,
      storageProvider: "yandex-object-storage",
      objectKey: `cases/case-1/staff-file-${staffActor.userId}/object.pdf`,
      fileName: "staff-document.pdf",
      mimeType: "application/pdf",
      sizeBytes: BigInt(1024),
    }),
    /FILE_UPLOAD_FORBIDDEN/,
  );
}
assert.equal(repository.current, null);

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
assert.equal((await service.list(actor, clientCase.id)).length, 0);

const pendingScan = await service.markUploadPendingScan(actor, pending.id, now);
assert.equal(pendingScan.status, "PENDING_SCAN");
assert.equal(pendingScan.readyAt, null);
assert.equal(repository.lastAuditActorUserId, actor.userId);
assert.deepEqual(
  (await service.list(actor, clientCase.id)).map((file) => file.id),
  [pending.id],
  "CLIENT must see their completed upload while it waits for security scan",
);
assert.equal(
  (await service.list(manager, clientCase.id)).length,
  0,
  "MANAGER must not see a non-READY file as available case material",
);
assert.equal(
  (await service.list(lawyer, clientCase.id)).length,
  0,
  "LAWYER must not see a non-READY file as available case material",
);
await assert.rejects(service.get(actor, pending.id), /FILE_NOT_FOUND/);
await assert.rejects(service.get(lawyer, pending.id), /FILE_NOT_FOUND/);

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

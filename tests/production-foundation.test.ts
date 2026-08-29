import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { canAccessClientCase } from "@/server/domain/client-cases/access-policy";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import { StoredFileService } from "@/server/domain/files/service";
import { createQuestionnaireDefinition } from "@/server/domain/questionnaire/definition";
import { TaskService } from "@/server/domain/tasks/service";
import {
  requireCaseActivityType,
  sanitizeActivityMetadata,
} from "@/server/domain/activity/taxonomy";
import { requireNotificationType } from "@/server/domain/notifications/taxonomy";
import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import type {
  ClaimedStoredFileScan,
  StoredFileRecord,
  StoredFileRepository,
  StoredFileStatus,
} from "@/server/domain/files/contracts";
import type {
  CreateTaskRepositoryInput,
  TaskRecord,
  TaskRepository,
  TaskStatus,
} from "@/server/domain/tasks/contracts";
import type { QuestionnaireSection } from "@/lib/platform/types";

const clientCase: ClientCaseRecord = {
  id: "case-1",
  caseNumber: "IBR-2026-000001",
  clientId: "client-1",
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

const actors: Record<string, AuthenticatedActor> = {
  client: { userId: "client-1", roles: ["CLIENT"] },
  otherClient: { userId: "client-2", roles: ["CLIENT"] },
  lawyer: { userId: "lawyer-1", roles: ["LAWYER"] },
  otherLawyer: { userId: "lawyer-2", roles: ["LAWYER"] },
  manager: { userId: "manager-1", roles: ["MANAGER"] },
  roleless: { userId: "user-1", roles: [] },
};

assert.equal(canAccessClientCase(actors.client, clientCase), true);
assert.equal(canAccessClientCase(actors.otherClient, clientCase), false);
assert.equal(canAccessClientCase(actors.lawyer, clientCase), true);
assert.equal(canAccessClientCase(actors.otherLawyer, clientCase), false);
assert.equal(canAccessClientCase(actors.manager, clientCase), true);
assert.equal(canAccessClientCase(actors.roleless, clientCase), false);

const sections = [
  {
    id: "personal",
    number: 1,
    title: "Personal",
    description: "",
    fields: [
      { id: "name", label: "Name", type: "text" },
      { id: "age", label: "Age", type: "number" },
    ],
  },
  {
    id: "finance",
    number: 2,
    title: "Finance",
    description: "",
    fields: [{ id: "income", label: "Income", type: "currency" }],
  },
] satisfies QuestionnaireSection[];

const definition = createQuestionnaireDefinition(sections, 1);
assert.equal(definition.schemaVersion, 1);
assert.deepEqual([...definition.sectionIds], ["personal", "finance"]);
assert.deepEqual([...definition.fieldIds], ["name", "age", "income"]);

assert.throws(() => createQuestionnaireDefinition(sections, 0), /QUESTIONNAIRE_INVALID_SCHEMA_VERSION/);

const duplicateFieldSections = [
  sections[0],
  {
    id: "other",
    number: 3,
    title: "Other",
    description: "",
    fields: [{ id: "name", label: "Duplicate", type: "text" }],
  },
] satisfies QuestionnaireSection[];

assert.throws(
  () => createQuestionnaireDefinition(duplicateFieldSections, 1),
  /QUESTIONNAIRE_DUPLICATE_FIELD:name/,
);

assert.equal(requireCaseActivityType("task.status.changed"), "task.status.changed");
assert.equal(requireCaseActivityType("file.scan.clean"), "file.scan.clean");
assert.throws(() => requireCaseActivityType("custom.raw.event"), /ACTIVITY_INVALID_TYPE/);
assert.deepEqual(
  sanitizeActivityMetadata({ taskId: "task-1", fromStatus: "NEW", toStatus: "WORKING" }),
  { taskId: "task-1", fromStatus: "NEW", toStatus: "WORKING" },
);
assert.throws(
  () => sanitizeActivityMetadata({ password: "must-not-be-logged" }),
  /ACTIVITY_INVALID_METADATA/,
);
assert.equal(requireNotificationType("document.reviewed"), "document.reviewed");
assert.throws(() => requireNotificationType("free-form"), /NOTIFICATION_INVALID_TYPE/);

const now = new Date("2026-08-28T00:00:00.000Z");
const task: TaskRecord = {
  id: "task-1",
  clientCaseId: clientCase.id,
  assigneeId: actors.lawyer.userId,
  title: "Review documents",
  description: null,
  status: "NEW",
  dueAt: null,
  startedAt: null,
  completedAt: null,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

class InMemoryTaskRepository implements TaskRepository {
  current = task;

  async getAccessible(_actor: AuthenticatedActor, taskId: string) {
    void _actor;
    return taskId === this.current.id ? this.current : null;
  }

  async listAccessible(_actor: AuthenticatedActor) {
    void _actor;
    return [this.current];
  }

  async create(input: CreateTaskRepositoryInput) {
    this.current = {
      id: "task-created",
      clientCaseId: input.clientCaseId,
      assigneeId: input.assigneeId,
      title: input.title,
      description: input.description,
      status: "NEW",
      dueAt: input.dueAt,
      startedAt: null,
      completedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return this.current;
  }

  async updateStatus(input: {
    actor: AuthenticatedActor;
    taskId: string;
    status: TaskStatus;
    expectedVersion: number;
  }) {
    assert.equal(input.taskId, this.current.id);
    assert.equal(input.expectedVersion, this.current.version);
    this.current = {
      ...this.current,
      status: input.status,
      startedAt: input.status === "WORKING" ? now : this.current.startedAt,
      completedAt: input.status === "DONE" ? now : null,
      version: this.current.version + 1,
      updatedAt: now,
    };
    return this.current;
  }
}

async function testTaskAuthorization() {
  const repository = new InMemoryTaskRepository();
  const cases = new ClientCaseService(new InMemoryCaseRepository());
  const service = new TaskService(cases, repository);

  assert.equal((await service.get(actors.lawyer, task.id))?.id, task.id);
  assert.equal(await service.get(actors.otherLawyer, task.id), null);
  assert.equal(await service.get(actors.client, task.id), null);
  assert.equal((await service.get(actors.manager, task.id))?.id, task.id);

  assert.equal((await service.list(actors.lawyer)).length, 1);
  assert.equal((await service.list(actors.otherLawyer)).length, 0);
  assert.equal((await service.list(actors.client)).length, 0);
  assert.equal((await service.list(actors.manager)).length, 1);

  await assert.rejects(
    service.updateStatus(actors.otherLawyer, { taskId: task.id, status: "WORKING", expectedVersion: 1 }),
    /TASK_FORBIDDEN/,
  );

  const working = await service.updateStatus(actors.lawyer, {
    taskId: task.id,
    status: "WORKING",
    expectedVersion: 1,
  });
  assert.equal(working.status, "WORKING");
  assert.equal(working.version, 2);

  const done = await service.updateStatus(actors.manager, {
    taskId: task.id,
    status: "DONE",
    expectedVersion: 2,
  });
  assert.equal(done.status, "DONE");
  assert.equal(done.version, 3);
}

class InMemoryCaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    if (scope.caseId && scope.caseId !== clientCase.id) return null;
    if (scope.caseNumber && scope.caseNumber !== clientCase.caseNumber) return null;
    return clientCase;
  }

  async listAccessibleCases() {
    return [clientCase];
  }
}

class InMemoryStoredFileRepository implements StoredFileRepository {
  current: StoredFileRecord | null = null;

  async listByCase(clientCaseId: string) {
    return this.current && this.current.clientCaseId === clientCaseId && this.current.status === "READY"
      ? [this.current]
      : [];
  }

  async getById(fileId: string) {
    return this.current?.id === fileId ? this.current : null;
  }

  async listPendingBefore(before: Date, limit: number) {
    if (
      this.current &&
      this.current.status === "PENDING_UPLOAD" &&
      this.current.createdAt < before &&
      limit > 0
    ) {
      return [this.current];
    }
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

  async markPendingScan(fileId: string, scanNextAttemptAt: Date) {
    if (this.current?.id !== fileId || this.current.status !== "PENDING_UPLOAD") return null;
    this.current = { ...this.current, status: "PENDING_SCAN", scanNextAttemptAt };
    return this.current;
  }

  async claimDueScan(input: { now: Date; leaseUntil: Date }) {
    if (
      !this.current ||
      (this.current.status !== "PENDING_SCAN" && this.current.status !== "SCANNING") ||
      (this.current.status === "PENDING_SCAN" &&
        (!this.current.scanNextAttemptAt || this.current.scanNextAttemptAt > input.now)) ||
      (this.current.status === "SCANNING" &&
        (!this.current.scanLeaseUntil || this.current.scanLeaseUntil > input.now))
    ) {
      return null;
    }
    const leaseToken = randomUUID();
    this.current = {
      ...this.current,
      status: "SCANNING",
      scanLeaseUntil: input.leaseUntil,
      scanLeaseToken: leaseToken,
      scanAttemptCount: this.current.scanAttemptCount + 1,
    };
    return this.current as ClaimedStoredFileScan;
  }

  async markScanClean(input: { fileId: string; leaseToken: string; providerCode: string; scannedAt: Date }) {
    if (
      this.current?.id !== input.fileId ||
      this.current.status !== "SCANNING" ||
      this.current.scanLeaseToken !== input.leaseToken
    ) return null;
    this.current = {
      ...this.current,
      status: "READY",
      scanProvider: input.providerCode,
      scannedAt: input.scannedAt,
      readyAt: input.scannedAt,
      scanNextAttemptAt: null,
      scanLeaseUntil: null,
      scanLeaseToken: null,
    };
    return this.current;
  }

  async markScanQuarantined(input: { fileId: string; leaseToken: string; providerCode: string; scannedAt: Date }) {
    if (
      this.current?.id !== input.fileId ||
      this.current.status !== "SCANNING" ||
      this.current.scanLeaseToken !== input.leaseToken
    ) return null;
    this.current = {
      ...this.current,
      status: "QUARANTINED",
      scanProvider: input.providerCode,
      scannedAt: input.scannedAt,
      quarantinedAt: input.scannedAt,
      scanNextAttemptAt: null,
      scanLeaseUntil: null,
      scanLeaseToken: null,
    };
    return this.current;
  }

  async rescheduleScan(input: { fileId: string; leaseToken: string; nextAttemptAt: Date; providerCode: string; errorCode: string }) {
    if (
      this.current?.id !== input.fileId ||
      this.current.status !== "SCANNING" ||
      this.current.scanLeaseToken !== input.leaseToken
    ) return false;
    this.current = {
      ...this.current,
      status: "PENDING_SCAN",
      scanProvider: input.providerCode,
      scanLastErrorCode: input.errorCode,
      scanNextAttemptAt: input.nextAttemptAt,
      scanLeaseUntil: null,
      scanLeaseToken: null,
    };
    return true;
  }

  async markScanFailed(input: { fileId: string; leaseToken: string; providerCode: string; scannedAt: Date; errorCode: string }) {
    if (
      this.current?.id !== input.fileId ||
      this.current.status !== "SCANNING" ||
      this.current.scanLeaseToken !== input.leaseToken
    ) return false;
    this.current = {
      ...this.current,
      status: "SCAN_FAILED",
      scanProvider: input.providerCode,
      scanLastErrorCode: input.errorCode,
      scannedAt: input.scannedAt,
      scanNextAttemptAt: null,
      scanLeaseUntil: null,
      scanLeaseToken: null,
    };
    return true;
  }

  async deletePending(fileId: string) {
    if (this.current?.id !== fileId || this.current.status !== "PENDING_UPLOAD") return false;
    this.current = null;
    return true;
  }

  async restorePending(file: StoredFileRecord) {
    if (this.current) return false;
    this.current = { ...file };
    return true;
  }
}

async function testStoredFileLifecycle() {
  const repository = new InMemoryStoredFileRepository();
  const cases = new ClientCaseService(new InMemoryCaseRepository());
  const service = new StoredFileService(cases, repository);

  const pending = await service.registerPendingUpload(actors.client, {
    id: "file-1",
    clientCaseId: clientCase.id,
    storageProvider: "yandex-object-storage",
    objectKey: "cases/case-1/file-1/object.pdf",
    fileName: "document.pdf",
    mimeType: "application/pdf",
    sizeBytes: BigInt(1024),
  });
  assert.equal(pending.status, "PENDING_UPLOAD");
  assert.equal((await service.list(actors.client, clientCase.id)).length, 0);
  await assert.rejects(service.get(actors.client, pending.id), /FILE_NOT_FOUND/);
  await assert.rejects(service.getPendingUpload(actors.otherClient, pending.id), /FILE_CASE_NOT_FOUND/);
  assert.equal((await service.getPendingUpload(actors.client, pending.id)).id, pending.id);

  const pendingScan = await service.markUploadPendingScan(actors.client, pending.id, now);
  assert.equal(pendingScan.status, "PENDING_SCAN");
  assert.equal((await service.list(actors.client, clientCase.id)).length, 0);
  await assert.rejects(service.get(actors.lawyer, pending.id), /FILE_NOT_FOUND/);
  await assert.rejects(service.getPendingUpload(actors.client, pending.id), /FILE_UPLOAD_NOT_PENDING/);

  const claimed = await repository.claimDueScan({
    now,
    leaseUntil: new Date(now.getTime() + 60_000),
  });
  assert.ok(claimed);
  assert.equal(claimed.status, "SCANNING");
  await assert.rejects(service.get(actors.lawyer, pending.id), /FILE_NOT_FOUND/);

  const ready = await repository.markScanClean({
    fileId: pending.id,
    leaseToken: claimed.scanLeaseToken,
    providerCode: "test-scanner",
    scannedAt: now,
  });
  assert.ok(ready);
  assert.equal(ready.status, "READY");
  assert.ok(ready.readyAt);
  assert.equal((await service.list(actors.client, clientCase.id)).length, 1);
  assert.equal((await service.get(actors.lawyer, pending.id)).id, pending.id);
}

await testTaskAuthorization();
await testStoredFileLifecycle();

console.log("production foundation tests: PASS");

import assert from "node:assert/strict";

import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  AuthenticatedActor,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import type {
  StoredFileRecord,
  StoredFileRepository,
  StoredFileStatus,
} from "@/server/domain/files/contracts";
import { StoredFileService } from "@/server/domain/files/service";

const clientCase: ClientCaseRecord = {
  id: "case-1",
  caseNumber: "А65-1/2026",
  clientId: "client-1",
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

function storedFile(
  id: string,
  status: StoredFileStatus,
  uploadedById: string | null,
): StoredFileRecord {
  const readyAt = status === "READY" ? new Date("2026-09-05T12:00:00Z") : null;
  return {
    id,
    clientCaseId: clientCase.id,
    uploadedById,
    status,
    storageProvider: "vercel-blob",
    objectKey: `cases/${clientCase.id}/${id}`,
    fileName: `${id}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 1024n,
    checksumSha256: null,
    scanAttemptCount: 0,
    scanNextAttemptAt: null,
    scanLeaseUntil: null,
    scanLeaseToken: null,
    scanProvider: null,
    scanLastErrorCode: null,
    scannedAt: readyAt,
    quarantinedAt: status === "QUARANTINED" ? new Date("2026-09-05T12:00:00Z") : null,
    readyAt,
    createdAt: new Date("2026-09-05T11:00:00Z"),
  };
}

const records = [
  storedFile("ready-other", "READY", "someone-else"),
  storedFile("pending-own", "PENDING_SCAN", "client-1"),
  storedFile("scanning-own", "SCANNING", "client-1"),
  storedFile("failed-own", "SCAN_FAILED", "client-1"),
  storedFile("quarantined-own", "QUARANTINED", "client-1"),
  storedFile("pending-other", "PENDING_SCAN", "someone-else"),
  storedFile("upload-own", "PENDING_UPLOAD", "client-1"),
];

const caseRepository = {
  async findAccessibleCase() {
    return clientCase;
  },
  async listAccessibleCases() {
    return [clientCase];
  },
} as ClientCaseRepository;

const fileRepository = {
  async listByCase() {
    return records;
  },
} as unknown as StoredFileRepository;

const service = new StoredFileService(new ClientCaseService(caseRepository), fileRepository);

const clientActor: AuthenticatedActor = { userId: "client-1", roles: ["CLIENT"] };
const managerActor: AuthenticatedActor = { userId: "manager-1", roles: ["MANAGER"] };

const clientVisible = await service.list(clientActor, clientCase.id);
assert.deepEqual(
  clientVisible.map((file) => file.id),
  ["ready-other", "pending-own", "scanning-own", "failed-own", "quarantined-own"],
  "CLIENT should see READY files plus their own completed uploads in scan states, but not pending uploads or another user's unsafe file",
);

const managerVisible = await service.list(managerActor, clientCase.id);
assert.deepEqual(
  managerVisible.map((file) => file.id),
  ["ready-other"],
  "STAFF oversight must continue to expose only READY files",
);

console.log("file-list-visibility.test.ts: PASS");

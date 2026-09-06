import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FILE_DELETION_MODE_INVALID,
  readStoredFileDeletionMode,
} from "../server/files/deletion-mode";

const [
  operationsSource,
  deletionModeSource,
  contractsSource,
  workerSource,
  schemaSource,
  migrationSource,
  repositorySource,
  requestServiceSource,
  requestRuntimeSource,
  maintenanceRouteSource,
  workerRuntimeSource,
] = await Promise.all([
  readFile(resolve("server/files/operations.ts"), "utf8"),
  readFile(resolve("server/files/deletion-mode.ts"), "utf8"),
  readFile(resolve("server/domain/files/deletion-contracts.ts"), "utf8"),
  readFile(resolve("server/domain/files/deletion-worker.ts"), "utf8"),
  readFile(resolve("prisma/schema.prisma"), "utf8"),
  readFile(resolve("prisma/migrations/20260906_stored_file_deletion_foundation/migration.sql"), "utf8"),
  readFile(resolve("server/repositories/prisma/stored-file-deletion-repository.ts"), "utf8"),
  readFile(resolve("server/domain/files/deletion-request-service.ts"), "utf8"),
  readFile(resolve("server/files/deletion-request-runtime.ts"), "utf8"),
  readFile(resolve("app/api/internal/maintenance/file-deletions/route.ts"), "utf8"),
  readFile(resolve("server/files/deletion-worker-runtime.ts"), "utf8"),
]);

// Cutover remains fail-closed and backward-compatible until the additive staging
// migration is explicitly approved and verified. Missing mode means legacy;
// durable requires an explicit exact value and unknown values never fall through.
assert.equal(readStoredFileDeletionMode({}), "legacy");
assert.equal(readStoredFileDeletionMode({ IB_FILE_DELETION_MODE: "legacy" }), "legacy");
assert.equal(readStoredFileDeletionMode({ IB_FILE_DELETION_MODE: "durable" }), "durable");
assert.throws(
  () => readStoredFileDeletionMode({ IB_FILE_DELETION_MODE: "enabled" }),
  new RegExp(FILE_DELETION_MODE_INVALID),
);
assert.throws(
  () => readStoredFileDeletionMode({ IB_FILE_DELETION_MODE: "DURABLE" }),
  new RegExp(FILE_DELETION_MODE_INVALID),
);
assert.match(deletionModeSource, /export type StoredFileDeletionMode = "legacy" \| "durable"/);
assert.match(deletionModeSource, /if \(!raw \|\| raw === "legacy"\) return "legacy"/);
assert.match(deletionModeSource, /if \(raw === "durable"\) return "durable"/);
assert.match(deletionModeSource, /throw new Error\(FILE_DELETION_MODE_INVALID\)/);

// Live DELETE keeps the proven legacy path by default, while explicit durable
// mode only enqueues the owner-scoped tombstone and preserves the existing
// transport response shape. Physical deletion/finalization remains worker-only.
assert.match(operationsSource, /readStoredFileDeletionMode\(\) === "durable"/);
assert.match(
  operationsSource,
  /getStoredFileDeletionRequestService\(\)\.request\(actor, fileId\)/,
);
assert.match(operationsSource, /return \{ fileId: deletion\.fileId \};/);
assert.match(operationsSource, /storedFileService\.takeOwnedForDeletion\(actor, fileId\)/);
assert.match(operationsSource, /storedFileService\.restoreDeleted\(deleted\)/);
assert.doesNotMatch(
  operationsSource,
  /claimDueDeletion|finalizeDeletion|rescheduleDeletion|markDeletionRequiresAttention/,
);

assert.match(contractsSource, /"PENDING"/);
assert.match(contractsSource, /"PROCESSING"/);
assert.match(contractsSource, /"COMPLETED"/);
assert.match(contractsSource, /"REQUIRES_ATTENTION"/);
assert.match(contractsSource, /interface StoredFileDeletionEnqueueRepository/);
assert.match(contractsSource, /enqueueDeletion/);
assert.doesNotMatch(contractsSource, /fileName|mimeType|checksumSha256|signedUrl|email/i);

assert.match(workerSource, /storage\.deleteObject\(deletion\.objectKey\)/);
assert.match(workerSource, /repository\.finalizeDeletion/);
assert.match(workerSource, /repository\.rescheduleDeletion/);
assert.match(workerSource, /repository\.markDeletionRequiresAttention/);
assert.match(workerSource, /finalizationDeferred/);
assert.doesNotMatch(workerSource, /restoreDeleted/);
assert.doesNotMatch(workerSource, /console\.(?:log|error|warn)/);

assert.match(schemaSource, /enum StoredFileDeletionStatus \{/);
const modelMatch = schemaSource.match(/model StoredFileDeletion \{([\s\S]*?)\n\}/);
assert.ok(modelMatch, "StoredFileDeletion Prisma model must exist");
const deletionModel = modelMatch[1];
assert.match(deletionModel, /fileId\s+String\s+@id\s+@db\.Uuid/);
assert.match(deletionModel, /completionActivityEventId\s+String\?\s+@unique\s+@db\.Uuid/);
assert.match(deletionModel, /@@unique\(\[storageProvider, objectKey\]\)/);
assert.doesNotMatch(deletionModel, /fileName|mimeType|checksumSha256|signedUrl|email/i);
assert.doesNotMatch(deletionModel, /@relation/);

assert.match(migrationSource, /CREATE TYPE "StoredFileDeletionStatus"/);
assert.match(migrationSource, /CREATE TABLE "StoredFileDeletion"/);
assert.match(migrationSource, /StoredFileDeletion_storageProvider_objectKey_key/);
assert.doesNotMatch(migrationSource, /FOREIGN KEY|REFERENCES/i);
assert.doesNotMatch(migrationSource, /DROP\s+(?:TABLE|TYPE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);

assert.match(repositorySource, /class PrismaStoredFileDeletionRepository/);
assert.match(repositorySource, /async enqueueDeletion/);
assert.match(repositorySource, /input\.originalFileStatus === "PENDING_UPLOAD"/);
assert.match(repositorySource, /input\.originalFileStatus === "SCANNING"/);
assert.match(repositorySource, /tx\.storedFile\.deleteMany/);
assert.match(repositorySource, /uploadedById: input\.requestedByUserId/);
assert.match(repositorySource, /storageProvider: input\.storageProvider/);
assert.match(repositorySource, /objectKey: input\.objectKey/);
assert.match(repositorySource, /status: input\.originalFileStatus/);
assert.match(repositorySource, /tx\.storedFileDeletion\.create/);
assert.match(repositorySource, /nextAttemptAt: input\.requestedAt/);
assert.match(repositorySource, /requestedAt: input\.requestedAt/);
assert.match(repositorySource, /storedFileDeletion\.findFirst/);
assert.match(repositorySource, /attemptCount:\s*\{ increment: 1 \}/);
assert.match(repositorySource, /storedFileDeletion\.updateMany/);
assert.match(repositorySource, /prisma\.\$transaction/);
assert.match(repositorySource, /buildCaseActivityWrite/);
assert.match(repositorySource, /type: "file\.deleted"/);
assert.doesNotMatch(repositorySource, /console\.(?:log|error|warn)/);

// Request-side boundary: CLIENT-only, owner-scoped, idempotent tombstone lookup,
// provider-pinned atomic enqueue, and race recovery without performing the
// irreversible object deletion in the request path.
assert.match(requestServiceSource, /actor\.roles\.includes\("CLIENT"\)/);
assert.match(requestServiceSource, /actor\.roles\.includes\("LAWYER"\)/);
assert.match(requestServiceSource, /actor\.roles\.includes\("MANAGER"\)/);
assert.match(requestServiceSource, /if \(!isClient \|\| isStaff\) throw new Error\(FILE_DELETE_FORBIDDEN\)/);
assert.match(requestServiceSource, /this\.deletions\.getByFileId\(fileId\)/);
assert.match(requestServiceSource, /existing\.requestedByUserId !== actor\.userId/);
assert.match(requestServiceSource, /throw new Error\(FILE_NOT_FOUND\)/);
assert.match(requestServiceSource, /this\.files\.getOwnedForDeletion\(actor, fileId\)/);
assert.match(requestServiceSource, /candidate\.storageProvider !== this\.expectedStorageProvider/);
assert.match(requestServiceSource, /this\.deletions\.enqueueDeletion/);
assert.match(requestServiceSource, /requestedByUserId: actor\.userId/);
assert.match(requestServiceSource, /const raced = await this\.existingOwnedDeletion\(actor, fileId\)/);
assert.match(requestServiceSource, /throw new Error\(FILE_DELETE_CONFLICT\)/);
assert.doesNotMatch(requestServiceSource, /deleteObject\(|takeOwnedForDeletion|restoreDeleted|fileName|mimeType|checksumSha256|signedUrl|email/i);
assert.doesNotMatch(requestServiceSource, /console\.(?:log|error|warn)/);

assert.match(requestRuntimeSource, /new StoredFileDeletionRequestService/);
assert.match(requestRuntimeSource, /new PrismaStoredFileDeletionRepository\(\)/);
assert.match(requestRuntimeSource, /storage\.providerCode/);
assert.doesNotMatch(requestRuntimeSource, /deleteObject\(/);

// Worker exposure is maintenance-only, authenticated before execution, bounded
// to one claim per invocation, and returns aggregate counters only.
const maintenanceConfigIndex = maintenanceRouteSource.indexOf("readMaintenanceRuntimeConfig()");
const maintenanceAuthIndex = maintenanceRouteSource.indexOf(
  "isAuthorizedMaintenanceRequest(request, config.secret)",
);
const maintenanceWorkerIndex = maintenanceRouteSource.indexOf(
  "getStoredFileDeletionWorker().runBatch",
);
assert.ok(maintenanceConfigIndex >= 0);
assert.ok(maintenanceAuthIndex > maintenanceConfigIndex);
assert.ok(maintenanceWorkerIndex > maintenanceAuthIndex);
assert.match(maintenanceRouteSource, /const FILE_DELETION_BATCH_LIMIT = 1;/);
assert.match(maintenanceRouteSource, /FILE_DELETION_ATTENTION_REQUIRED/);
assert.match(maintenanceRouteSource, /Cache-Control": "no-store"/);
assert.doesNotMatch(
  maintenanceRouteSource,
  /fileId\s*:|clientCaseId\s*:|requestedByUserId\s*:|objectKey\s*:|leaseToken\s*:/,
);

assert.match(workerRuntimeSource, /new StoredFileDeletionWorker/);
assert.match(workerRuntimeSource, /new PrismaStoredFileDeletionRepository\(\)/);
assert.match(workerRuntimeSource, /getPrivateObjectStorage\(\)/);
assert.doesNotMatch(workerRuntimeSource, /console\.(?:log|error|warn)/);

console.log("FILE_DELETION_FOUNDATION_CONTRACT_PASS");

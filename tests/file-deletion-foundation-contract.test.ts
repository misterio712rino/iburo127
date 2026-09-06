import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [operationsSource, contractsSource, workerSource, schemaSource, migrationSource, repositorySource] =
  await Promise.all([
    readFile(resolve("server/files/operations.ts"), "utf8"),
    readFile(resolve("server/domain/files/deletion-contracts.ts"), "utf8"),
    readFile(resolve("server/domain/files/deletion-worker.ts"), "utf8"),
    readFile(resolve("prisma/schema.prisma"), "utf8"),
    readFile(resolve("prisma/migrations/20260906_stored_file_deletion_foundation/migration.sql"), "utf8"),
    readFile(resolve("server/repositories/prisma/stored-file-deletion-repository.ts"), "utf8"),
  ]);

assert.match(operationsSource, /storedFileService\.takeOwnedForDeletion\(actor, fileId\)/);
assert.match(operationsSource, /storedFileService\.restoreDeleted\(deleted\)/);
assert.doesNotMatch(operationsSource, /claimDueDeletion|finalizeDeletion|StoredFileDeletion/);

assert.match(contractsSource, /"PENDING"/);
assert.match(contractsSource, /"PROCESSING"/);
assert.match(contractsSource, /"COMPLETED"/);
assert.match(contractsSource, /"REQUIRES_ATTENTION"/);
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

console.log("FILE_DELETION_FOUNDATION_CONTRACT_PASS");

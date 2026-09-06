import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [operationsSource, contractsSource, workerSource] = await Promise.all([
  readFile(resolve("server/files/operations.ts"), "utf8"),
  readFile(resolve("server/domain/files/deletion-contracts.ts"), "utf8"),
  readFile(resolve("server/domain/files/deletion-worker.ts"), "utf8"),
]);

assert.match(operationsSource, /storedFileService\.takeOwnedForDeletion\(actor, fileId\)/);
assert.match(operationsSource, /storedFileService\.restoreDeleted\(deleted\)/);
assert.doesNotMatch(operationsSource, /claimDueDeletion|finalizeDeletion|StoredFileDeletion/);

assert.match(contractsSource, /"PENDING"/);
assert.match(contractsSource, /"PROCESSING"/);
assert.match(contractsSource, /"COMPLETED"/);
assert.match(contractsSource, /"REQUIRES_ATTENTION"/);
assert.doesNotMatch(contractsSource, /fileName|mimeType|checksumSha256|signedUrl|email/i);

assert.match(workerSource, /storage\.deleteObject\(deletion\.objectKey\)/);
assert.match(workerSource, /repository\.finalizeDeletion/);
assert.match(workerSource, /repository\.rescheduleDeletion/);
assert.match(workerSource, /repository\.markDeletionRequiresAttention/);
assert.match(workerSource, /finalizationDeferred/);
assert.doesNotMatch(workerSource, /restoreDeleted/);
assert.doesNotMatch(workerSource, /console\.(?:log|error|warn)/);

console.log("FILE_DELETION_FOUNDATION_CONTRACT_PASS");

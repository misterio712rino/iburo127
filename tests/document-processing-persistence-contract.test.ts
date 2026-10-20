import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const schema = await readFile(resolve("prisma/schema.prisma"), "utf8");
const migration = await readFile(
  resolve("prisma/migrations/20261020_document_processing_jobs/migration.sql"),
  "utf8",
);
const completionGuardMigration = await readFile(
  resolve("prisma/migrations/20261020_document_processing_jobs_completion_guard/migration.sql"),
  "utf8",
);
const fileRepository = await readFile(
  resolve("server/repositories/prisma/stored-file-repository.ts"),
  "utf8",
);
const fileOperations = await readFile(resolve("server/files/operations.ts"), "utf8");
const documentJobRepository = await readFile(resolve("server/repositories/prisma/document-processing-job-repository.ts"), "utf8");
const repository = await readFile(
  resolve("server/repositories/prisma/document-processing-job-repository.ts"),
  "utf8",
);
const runtime = await readFile(
  resolve("server/files/document-processing-worker-runtime.ts"),
  "utf8",
);
const route = await readFile(
  resolve("app/api/internal/maintenance/document-processing/route.ts"),
  "utf8",
);
const productionConfig = await readFile(resolve("server/config/production.ts"), "utf8");
const workflow = (await readFile(
  resolve(".github/workflows/document-processing-maintenance-scheduler.yml"),
  "utf8",
)).replace(/\r\n/g, "\n");

assert.match(schema, /enum DocumentProcessingStatus \{\s+PENDING\s+PROCESSING\s+COMPLETED\s+FAILED\s+CANCELLED\s+\}/);
assert.match(schema, /model DocumentProcessingJob \{[\s\S]*?sourceFileId\s+String\s+@db\.Uuid[\s\S]*?pageTexts\s+Json\?[\s\S]*?sourceFile StoredFile @relation\(fields: \[sourceFileId, clientCaseId\], references: \[id, clientCaseId\]/);
assert.match(schema, /@@unique\(\[id, clientCaseId\]\)/);

assert.match(migration, /^BEGIN;/);
assert.match(migration, /CREATE TYPE "DocumentProcessingStatus"/);
assert.match(migration, /DocumentProcessingJob_sourceFileId_clientCaseId_fkey/);
assert.match(migration, /ON DELETE CASCADE/);
assert.match(migration, /DocumentProcessingJob_lease_check/);
assert.match(migration, /DocumentProcessingJob_completion_check/);
assert.match(completionGuardMigration, /"pageTexts" IS NOT NULL/);
assert.match(completionGuardMigration, /ALTER TABLE "DocumentProcessingJob"/);
assert.match(migration, /DocumentProcessingJob_failure_check/);
assert.match(migration, /DocumentProcessingJob_cancellation_check/);
assert.match(migration, /COMMIT;\s*$/);
assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\s+INTO\b/i);

const readyIndex = fileRepository.indexOf('status: "READY"');
const enqueueIndex = fileRepository.indexOf("tx.documentProcessingJob.createMany");
const cleanAuditIndex = fileRepository.indexOf('type: "file.scan.clean"');
assert.ok(readyIndex >= 0 && enqueueIndex > readyIndex, "only a clean READY transition may enqueue OCR");
assert.ok(cleanAuditIndex > enqueueIndex, "file READY state and OCR enqueue must be committed in one transaction");

assert.match(repository, /sourceFile: \{ is: \{ status: "READY" as const \} \}/);
assert.match(repository, /const leaseToken = randomUUID\(\)/);
assert.match(repository, /attemptCount: \{ increment: 1 \}/);
assert.match(repository, /pageCount <= MAX_PAGES/);
assert.match(repository, /status: "COMPLETED"/);
assert.match(repository, /status: "FAILED"/);
assert.match(repository, /status: "CANCELLED"/);
assert.match(documentJobRepository, /throw new Error\("DOCUMENT_PROCESSING_FAILED:INVALID_OCR_OUTPUT"\)/);
assert.match(fileRepository, /documentProcessingJob\.findUnique/);
assert.ok(fileRepository.includes("processingJob: processingJob"));
assert.match(fileRepository, /documentProcessingJob\.create/);
assert.match(fileOperations, /const deletionSnapshot = await storedFileService\.takeOwnedForDeletion/);
assert.match(fileOperations, /storedFileService\.restoreDeleted\(deletionSnapshot\)/);
assert.match(fileRepository, /documentProcessingJob\.findUnique/);
assert.match(fileRepository, /documentProcessingJob\.create/);
assert.match(fileOperations, /const deletionSnapshot = await storedFileService\.takeOwnedForDeletion/);
assert.match(fileOperations, /storedFileService\.restoreDeleted\(deletionSnapshot\)/);
assert.match(runtime, /DOCUMENT_PROCESSOR_TIMEOUT_MS >= maintenance\.documentProcessingLeaseSeconds \* 1000/);
assert.match(runtime, /new PrismaDocumentProcessingJobRepository\(\)/);
assert.match(productionConfig, /"IB_DOCUMENT_PROCESSING_BATCH_LIMIT",[\s\S]*?1,[\s\S]*?1,[\s\S]*?1/);

const configIndex = route.indexOf("readMaintenanceRuntimeConfig()");
const authIndex = route.indexOf("isAuthorizedMaintenanceRequest(request, config.secret)");
const workerIndex = route.indexOf("getDocumentProcessingWorker().runBatch");
assert.ok(configIndex >= 0 && authIndex > configIndex && workerIndex > authIndex);
assert.match(route, /Cache-Control": "no-store"/);
assert.doesNotMatch(route, /pageTexts|sourceFileId|clientCaseId/);

assert.match(workflow, /vars\.IB_DOCUMENT_PROCESSING_SCHEDULER_ENABLED == 'true'/);
assert.match(workflow, /github\.ref_name == github\.event\.repository\.default_branch/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /contents: read/);
assert.match(workflow, /node scripts\/run-maintenance-job\.mjs document-processing/);
assert.doesNotMatch(workflow, /https?:\/\//);

console.log("DOCUMENT_PROCESSING_PERSISTENCE_CONTRACT_PASS");

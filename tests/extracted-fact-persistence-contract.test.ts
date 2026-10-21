import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(
  "prisma/migrations/20261020_extracted_fact_candidates/migration.sql",
), "utf8");
const worker = readFileSync(resolve("server/domain/documents/processing-worker.ts"), "utf8");
const repository = readFileSync(resolve(
  "server/repositories/prisma/document-processing-job-repository.ts",
), "utf8");

assert.match(schema, /enum ExtractedFactReviewStatus \{\s+NEEDS_REVIEW\s+CONFIRMED\s+REJECTED\s+\}/);
assert.match(schema, /model ExtractedFactCandidate \{[\s\S]*?clientCaseId\s+String[\s\S]*?sourceFileId\s+String[\s\S]*?recordKey\s+String[\s\S]*?sourcePage\s+Int[\s\S]*?value\s+Json[\s\S]*?confidence\s+Float[\s\S]*?reviewStatus\s+ExtractedFactReviewStatus/);
assert.match(schema, /@@unique\(\[sourceFileId, clientCaseId, recordKey, fieldPath, sourcePage\]\)/);
assert.match(migration, /"recordKey" VARCHAR\(80\) NOT NULL DEFAULT 'default'/);
assert.match(migration, /ExtractedFactCandidate_sourceFileId_clientCaseId_fkey/);
assert.match(migration, /"sourcePage" BETWEEN 1 AND 40/);
assert.match(migration, /"confidence" >= 0 AND "confidence" <= 1/);
assert.match(worker, /extractExplicitFactCandidates/);
assert.match(repository, /return prisma\.\$transaction\(async \(tx\)/);
assert.match(repository, /tx\.extractedFactCandidate\.createMany/);
assert.match(repository, /parseExtractedFactCandidate\(candidate\)/);
assert.match(repository, /candidate\.caseId !== job\.clientCaseId \|\| candidate\.sourceFileId !== job\.sourceFileId/);

console.log("EXTRACTED_FACT_PERSISTENCE_CONTRACT_PASS");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositorySource = await readFile(
  resolve("server/repositories/prisma/document-repository.ts"),
  "utf8",
);
const serviceSource = await readFile(resolve("server/domain/documents/service.ts"), "utf8");
const contractSource = await readFile(resolve("server/domain/documents/contracts.ts"), "utf8");

assert.match(
  repositorySource,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "document persistence must define the human-support plan boundary explicitly",
);

const scopeStart = repositorySource.indexOf("function actorDocumentWhere(");
const recordStart = repositorySource.indexOf("function toRecord(");
assert.ok(scopeStart >= 0 && recordStart > scopeStart, "document actor scope must exist");

const scopeSource = repositorySource.slice(scopeStart, recordStart);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("MANAGER"\)\) return \{\};/,
  "MANAGER oversight must remain a separate document-read audience",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("CLIENT"\)\) access\.push\(\{ clientId: actor\.userId \}\);/,
  "CLIENT document reads must remain owner-scoped",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("LAWYER"\)\)[\s\S]*assignedLawyerId:\s*actor\.userId[\s\S]*plan:\s*\{\s*code:\s*\{\s*in:\s*\[\.\.\.HUMAN_SUPPORT_PLAN_CODES\]\s*\}\s*\}/,
  "LAWYER document reads must require current assignment and a PRO or INDIVIDUAL plan",
);
assert.doesNotMatch(
  scopeSource,
  /HUMAN_SUPPORT_PLAN_CODES[^\n]*LITE|\["PRO",\s*"INDIVIDUAL",\s*"LITE"\]/,
  "LITE must never enter the LAWYER document-read scope",
);

const getStart = repositorySource.indexOf("  async getByCaseAndCode(");
const listStart = repositorySource.indexOf("  async listByCase(");
const createStart = repositorySource.indexOf("  async createForCase(");
assert.ok(
  getStart >= 0 && listStart > getStart && createStart > listStart,
  "document repository read paths must exist",
);

const getSource = repositorySource.slice(getStart, listStart);
const listSource = repositorySource.slice(listStart, createStart);
for (const [name, scopedSource] of [
  ["document lookup", getSource],
  ["document list", listSource],
] as const) {
  assert.match(
    scopedSource,
    /const scope = actorDocumentWhere\(actor\);/,
    `${name} must derive actor scope at the final persistence read`,
  );
  assert.match(
    scopedSource,
    /\.\.\.scope/,
    `${name} must apply actor scope in the Prisma where predicate`,
  );
}
assert.match(
  getSource,
  /findFirst\(\{[\s\S]*where:\s*\{\s*clientCaseId,\s*documentCode,\s*\.\.\.scope\s*\}/,
  "document lookup must combine identity and actor scope in one Prisma query",
);
assert.match(
  listSource,
  /findMany\(\{[\s\S]*where:\s*\{\s*clientCaseId,\s*\.\.\.scope\s*\}/,
  "document list must combine case identity and actor scope in one Prisma query",
);

assert.match(
  contractSource,
  /getByCaseAndCode\([\s\S]*actor:\s*AuthenticatedActor[\s\S]*\):\s*Promise<CaseDocumentRecord \| null>/,
  "document repository lookup contract must require an authenticated actor",
);
assert.match(
  contractSource,
  /listByCase\([\s\S]*actor:\s*AuthenticatedActor[\s\S]*\):\s*Promise<readonly CaseDocumentRecord\[\]>/,
  "document repository list contract must require an authenticated actor",
);

const normalizedService = serviceSource.replace(/\s+/g, " ");
assert.match(
  normalizedService,
  /repository\.listByCase\(clientCaseId, actor\)/,
  "document service must propagate actor to list persistence",
);
const getCalls = normalizedService.match(/repository\.getByCaseAndCode\([^)]*\)/g) ?? [];
assert.equal(getCalls.length, 5, "all document service lookup paths must remain covered");
for (const call of getCalls) {
  assert.match(call, /\bactor\b/, "every document lookup must propagate actor to persistence");
}

console.log("DOCUMENT_PERSISTENCE_PLAN_BOUNDARY_PASS");

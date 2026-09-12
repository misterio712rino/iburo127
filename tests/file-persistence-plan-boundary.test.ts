import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositorySource = await readFile(
  resolve("server/repositories/prisma/stored-file-repository.ts"),
  "utf8",
);
const serviceSource = await readFile(resolve("server/domain/files/service.ts"), "utf8");
const contractSource = await readFile(resolve("server/domain/files/contracts.ts"), "utf8");
const operationsSource = await readFile(resolve("server/files/operations.ts"), "utf8");

assert.match(
  repositorySource,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "file persistence must define the human-support plan boundary explicitly",
);

const scopeStart = repositorySource.indexOf("function actorFileWhere(");
const recordStart = repositorySource.indexOf("function toRecord(");
assert.ok(scopeStart >= 0 && recordStart > scopeStart, "file actor scope must exist");

const scopeSource = repositorySource.slice(scopeStart, recordStart);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("MANAGER"\)\) return \{\};/,
  "MANAGER oversight must remain a separate file-read audience",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("CLIENT"\)\) access\.push\(\{ clientId: actor\.userId \}\);/,
  "CLIENT file reads must remain owner-scoped",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("LAWYER"\)\)[\s\S]*assignedLawyerId:\s*actor\.userId[\s\S]*plan:\s*\{\s*code:\s*\{\s*in:\s*\[\.\.\.HUMAN_SUPPORT_PLAN_CODES\]\s*\}\s*\}/,
  "LAWYER file reads must require current assignment and a PRO or INDIVIDUAL plan",
);
assert.doesNotMatch(
  scopeSource,
  /HUMAN_SUPPORT_PLAN_CODES[^\n]*LITE|\["PRO",\s*"INDIVIDUAL",\s*"LITE"\]/,
  "LITE must never enter the LAWYER file-read scope",
);

const listStart = repositorySource.indexOf("  async listByCase(");
const getStart = repositorySource.indexOf("  async getById(");
const pendingStart = repositorySource.indexOf("  async listPendingBefore(");
assert.ok(
  listStart >= 0 && getStart > listStart && pendingStart > getStart,
  "interactive file repository read paths must exist",
);
const listSource = repositorySource.slice(listStart, getStart);
const getSource = repositorySource.slice(getStart, pendingStart);
for (const [name, scopedSource] of [
  ["file list", listSource],
  ["file lookup", getSource],
] as const) {
  assert.match(
    scopedSource,
    /const scope = actorFileWhere\(actor\);/,
    `${name} must derive actor scope at the final persistence read`,
  );
  assert.match(scopedSource, /\.\.\.scope/, `${name} must apply actor scope in Prisma`);
}
assert.match(
  listSource,
  /findMany\(\{[\s\S]*where:\s*\{\s*clientCaseId,\s*\.\.\.scope\s*\}/,
  "file list must combine case identity and actor scope in one Prisma query",
);
assert.match(
  getSource,
  /findFirst\(\{[\s\S]*where:\s*\{\s*id:\s*fileId,\s*\.\.\.scope\s*\}/,
  "file lookup must combine file identity and actor scope in one Prisma query",
);
assert.doesNotMatch(
  listSource,
  /status:\s*"READY"/,
  "persistence scope must not hide pending scan states from their owning CLIENT",
);

assert.match(
  contractSource,
  /listByCase\([\s\S]*actor:\s*AuthenticatedActor[\s\S]*\):\s*Promise<readonly StoredFileRecord\[\]>/,
  "file repository list contract must require an authenticated actor",
);
assert.match(
  contractSource,
  /getById\(fileId:\s*string,\s*actor:\s*AuthenticatedActor\):\s*Promise<StoredFileRecord \| null>/,
  "file repository lookup contract must require an authenticated actor",
);

const normalizedService = serviceSource.replace(/\s+/g, " ");
assert.match(
  normalizedService,
  /repository\.listByCase\(clientCaseId, actor\)/,
  "file service must propagate actor to list persistence",
);
const getCalls = normalizedService.match(/repository\.getById\([^)]*\)/g) ?? [];
assert.equal(getCalls.length, 3, "all interactive file lookup paths must remain covered");
for (const call of getCalls) {
  assert.match(call, /\bactor\b/, "every interactive file lookup must propagate actor to persistence");
}

assert.match(
  operationsSource,
  /const file = await storedFileService\.get\(actor, fileId\);[\s\S]*storage\.createDownloadUrl\(\{[\s\S]*objectKey: file\.objectKey/,
  "signed download URL creation must remain downstream of the actor-scoped READY file lookup",
);

console.log("FILE_PERSISTENCE_PLAN_BOUNDARY_PASS");

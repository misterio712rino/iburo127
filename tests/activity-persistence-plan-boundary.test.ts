import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositorySource = await readFile(
  resolve("server/repositories/prisma/activity-repository.ts"),
  "utf8",
);
const serviceSource = await readFile(resolve("server/domain/activity/service.ts"), "utf8");
const contractSource = await readFile(resolve("server/domain/activity/contracts.ts"), "utf8");

assert.match(
  repositorySource,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "activity persistence must define the human-support plan boundary explicitly",
);

const scopeStart = repositorySource.indexOf("function actorActivityWhere(");
const metadataStart = repositorySource.indexOf("function normalizeMetadata(");
assert.ok(scopeStart >= 0 && metadataStart > scopeStart, "activity actor scope must exist");

const scopeSource = repositorySource.slice(scopeStart, metadataStart);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("MANAGER"\)\) return \{\};/,
  "MANAGER oversight must remain a separate read audience",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("CLIENT"\)\) access\.push\(\{ clientId: actor\.userId \}\);/,
  "CLIENT activity reads must remain owner-scoped",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("LAWYER"\)\)[\s\S]*assignedLawyerId:\s*actor\.userId[\s\S]*plan:\s*\{\s*code:\s*\{\s*in:\s*\[\.\.\.HUMAN_SUPPORT_PLAN_CODES\]\s*\}\s*\}/,
  "LAWYER activity reads must require current assignment and a PRO or INDIVIDUAL plan",
);
assert.doesNotMatch(
  scopeSource,
  /HUMAN_SUPPORT_PLAN_CODES[^\n]*LITE|\["PRO",\s*"INDIVIDUAL",\s*"LITE"\]/,
  "LITE must never enter the LAWYER activity-read scope",
);

const listStart = repositorySource.indexOf("  async listByCase(");
const appendStart = repositorySource.indexOf("  async append(");
assert.ok(listStart >= 0 && appendStart > listStart, "activity repository read path must exist");
const listSource = repositorySource.slice(listStart, appendStart);
assert.match(
  listSource,
  /const scope = actorActivityWhere\(actor\);/,
  "activity repository must derive actor scope at the final persistence read",
);
assert.match(
  listSource,
  /where:\s*\{\s*clientCaseId,\s*\.\.\.scope\s*\}/,
  "activity event query must apply actor scope together with clientCaseId",
);

assert.match(
  contractSource,
  /listByCase\([\s\S]*actor:\s*AuthenticatedActor[\s\S]*\):\s*Promise<readonly CaseActivityRecord\[\]>/,
  "activity repository contract must require an authenticated actor for reads",
);
assert.match(
  serviceSource,
  /repository\.listByCase\(clientCaseId,\s*normalizeLimit\(limit\),\s*actor\)/,
  "activity service must propagate the authenticated actor to persistence",
);

console.log("ACTIVITY_PERSISTENCE_PLAN_BOUNDARY_PASS");

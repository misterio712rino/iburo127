import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("server/repositories/prisma/client-case-repository.ts"),
  "utf8",
);

assert.match(
  source,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "LAWYER case reads must define the human-support plan boundary explicitly",
);

const scopeStart = source.indexOf("function actorAccessWhere(");
const recordStart = source.indexOf("function toRecord(");
assert.ok(scopeStart >= 0 && recordStart > scopeStart, "shared case access scope must exist");

const scopeSource = source.slice(scopeStart, recordStart);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("MANAGER"\)\) return \{\};/,
  "MANAGER oversight must remain a separate read audience",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("CLIENT"\)\) access\.push\(\{ clientId: actor\.userId \}\);/,
  "CLIENT access must remain owner-scoped",
);
assert.match(
  scopeSource,
  /if \(actor\.roles\.includes\("LAWYER"\)\)[\s\S]*assignedLawyerId:\s*actor\.userId[\s\S]*plan:\s*\{\s*code:\s*\{\s*in:\s*\[\.\.\.HUMAN_SUPPORT_PLAN_CODES\]\s*\}\s*\}/,
  "LAWYER access must require current assignment and a PRO or INDIVIDUAL plan",
);
assert.doesNotMatch(
  scopeSource,
  /HUMAN_SUPPORT_PLAN_CODES[^\n]*LITE|\["PRO",\s*"INDIVIDUAL",\s*"LITE"\]/,
  "LITE must never enter the LAWYER case-read scope",
);

const findStart = source.indexOf("  async findAccessibleCase(");
const listStart = source.indexOf("  async listAccessibleCases(");
assert.ok(findStart >= 0 && listStart > findStart, "case repository read paths must exist");

const findSource = source.slice(findStart, listStart);
const listSource = source.slice(listStart);
for (const [name, scopedSource] of [
  ["case lookup", findSource],
  ["case list", listSource],
] as const) {
  assert.match(
    scopedSource,
    /const accessWhere = actorAccessWhere\(/,
    `${name} must use the shared actor access scope`,
  );
  assert.match(
    scopedSource,
    /where:\s*(?:\{|accessWhere)/,
    `${name} must apply the actor access scope in Prisma`,
  );
}

console.log("CLIENT_CASE_PERSISTENCE_PLAN_BOUNDARY_PASS");

await import("./activity-persistence-plan-boundary.test");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("server/repositories/prisma/client-case-repository.ts"),
  "utf8",
);

assert.match(
  source,
  /const LAWYER_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "LAWYER case reads must define the human-support plan boundary explicitly",
);

const listStart = source.indexOf("  async listAccessible(");
const getStart = source.indexOf("  async getAccessible(");
assert.ok(listStart >= 0 && getStart > listStart, "case repository read paths must exist");

const listSource = source.slice(listStart, getStart);
const getSource = source.slice(getStart);

for (const [name, scopedSource] of [
  ["LAWYER case list", listSource],
  ["LAWYER case get", getSource],
] as const) {
  assert.match(
    scopedSource,
    /assignedLawyerId:\s*actor\.userId/,
    `${name} must remain assignment-scoped`,
  );
  assert.match(
    scopedSource,
    /clientId:\s*\{\s*not:\s*actor\.userId\s*\}/,
    `${name} must not turn an owned CLIENT case into a LAWYER workspace`,
  );
  assert.match(
    scopedSource,
    /plan:\s*\{\s*code:\s*\{\s*in:\s*\[\.\.\.LAWYER_PLAN_CODES\]\s*\}\s*\}/,
    `${name} must require the current PRO or INDIVIDUAL plan at the Prisma boundary`,
  );
}

assert.match(
  source,
  /if \(actor\.roles\.includes\("MANAGER"\)\) \{[\s\S]*return rows\.map\(toRecord\);/,
  "MANAGER oversight must remain a separate read-only audience and not reuse LAWYER entitlement",
);

console.log("CLIENT_CASE_PERSISTENCE_PLAN_BOUNDARY_PASS");

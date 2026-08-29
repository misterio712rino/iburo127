import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const hubSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const progressSource = await readFile(resolve("app/portal/cases/[caseId]/progress/page.tsx"), "utf8");
const activitySource = await readFile(resolve("app/portal/cases/[caseId]/activity/page.tsx"), "utf8");
const questionnaireSource = await readFile(resolve("app/portal/cases/[caseId]/questionnaire/page.tsx"), "utf8");
const practicumSource = await readFile(resolve("app/portal/cases/[caseId]/practicum/page.tsx"), "utf8");
const documentsSource = await readFile(resolve("app/portal/cases/[caseId]/documents/page.tsx"), "utf8");
const filesSource = await readFile(resolve("app/portal/cases/[caseId]/files/page.tsx"), "utf8");
const tasksSource = await readFile(resolve("app/portal/cases/[caseId]/tasks/page.tsx"), "utf8");

assert.match(hubSource, /resolveCasePortalAudience\(actor, clientCase\)/);
assert.match(hubSource, /getCaseProgressSummaryForActor\(actor, clientCase, audience\)/);
assert.match(hubSource, /summary\.nextAction\.segment/);
assert.match(hubSource, /Сейчас важно/);
assert.match(hubSource, /module\.code === summary\.nextAction\.segment/);
assert.match(hubSource, /CLIENT_AI_MODULE/);
assert.match(hubSource, /STAFF_TASK_MODULE/);

for (const [path, source] of [
  ["progress", progressSource],
  ["activity", activitySource],
  ["questionnaire", questionnaireSource],
  ["practicum", practicumSource],
  ["documents", documentsSource],
  ["files", filesSource],
  ["tasks", tasksSource],
] as const) {
  assert.match(
    source,
    /resolveCasePortalAudience\(actor, clientCase\)/,
    `${path} must derive its CLIENT/STAFF presentation from the case relationship`,
  );
}

assert.match(
  activitySource,
  /buildCaseActivityView\(records, audience\)/,
  "activity projection must follow the case-specific audience rather than any global staff role",
);
assert.match(
  documentsSource,
  /audience === "STAFF"[\s\S]*clientCase\.clientId !== actor\.userId/,
  "review controls must not appear for the client of the same case even on a multi-role account",
);
assert.match(
  tasksSource,
  /if \(audience !== "STAFF"\) redirect/,
  "case-specific staff tasks must fail back to the case hub in CLIENT context",
);
assert.doesNotMatch(
  hubSource,
  /const isClient = actor\.roles\.includes\("CLIENT"\)/,
  "case hub must not derive presentation from a global CLIENT role alone",
);
assert.doesNotMatch(
  progressSource,
  /const isStaff = actor\.roles\.includes\("LAWYER"\) \|\| actor\.roles\.includes\("MANAGER"\)/,
  "progress audience must not be selected by global staff role alone",
);

console.log("CLIENT_CASE_HUB_CONTRACT_PASS");

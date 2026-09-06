import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sources = await Promise.all([
  "components/platform/lawyer/LawyerDashboard.tsx",
  "components/platform/lawyer/LawyerCasesList.tsx",
  "components/platform/lawyer/LawyerCaseDetail.tsx",
  "components/platform/lawyer/LawyerClients.tsx",
  "components/platform/lawyer/LawyerActivity.tsx",
  "components/platform/lawyer/LawyerTasks.tsx",
].map(async (path) => [path, await readFile(resolve(path), "utf8")] as const));

for (const [path, source] of sources) {
  assert.match(source, /getClientCaseDisplayNumber/, `${path} must format visible case numbers through the shared helper`);
}

const sourceByPath = Object.fromEntries(sources);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerDashboard.tsx"], /Дело № \{item\.clientCase\.caseNumber\}/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerCasesList.tsx"], />\{item\.clientCase\.caseNumber\}<\/p>/);
assert.match(sourceByPath["components/platform/lawyer/LawyerCasesList.tsx"], /code: "INDIVIDUAL", label: "ЭКСКЛЮЗИВ"/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerCasesList.tsx"], /label: "ИНДИВИДУАЛЬНЫЙ"/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerClients.tsx"], />\{item\.clientCase\.caseNumber\}<\/p>/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerCaseDetail.tsx"], /Дело № \{item\.clientCase\.caseNumber\}/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerActivity.tsx"], />\{event\.caseNumber\}<\/Link>/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerTasks.tsx"], />\{task\.caseNumber\}<\/Link>/);
assert.doesNotMatch(sourceByPath["components/platform/lawyer/LawyerDashboard.tsx"], />3 клиента в работе</);

console.log("DEMO_STAFF_CASE_NUMBER_PRESENTATION_TEST_PASS");

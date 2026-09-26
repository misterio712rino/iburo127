import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "app/_iburo/staging-maintenance-backlog-classifier/route.ts"),
  "utf8",
);

assert.match(source, /operation: "staging-maintenance-backlog-classifier"/);
assert.match(source, /readOnly: true/);
assert.match(source, /aggregateOnly: true/);
assert.match(source, /valuesPrinted: false/);
assert.match(source, /strictKnownTechnicalFixtures/);
assert.match(source, /unknownOrNonTechnical/);
assert.match(source, /TECHNICAL_E2E_MUTATION_CASE_NUMBER/);
assert.match(source, /TECHNICAL_E2E_CLIENT\.email/);
assert.match(source, /MAX_ROWS = 500/);

for (const forbidden of [
  ".delete(",
  ".deleteMany(",
  ".update(",
  ".updateMany(",
  ".create(",
  ".createMany(",
  ".upsert(",
  "deleteObject(",
  "putObject(",
]) {
  assert.equal(source.includes(forbidden), false, `read-only route must not contain ${forbidden}`);
}

const responseStart = source.indexOf("const body = {");
assert.notEqual(responseStart, -1);
const response = source.slice(responseStart);
for (const forbidden of [
  "objectKey",
  "clientCaseId",
  "requestedByUserId",
  "uploadedById",
  "caseNumberById",
  "emailById",
  "fileName:",
  "email:",
]) {
  assert.equal(
    response.includes(forbidden),
    false,
    `aggregate response must not expose ${forbidden}`,
  );
}

console.log("STAGING_MAINTENANCE_BACKLOG_CLASSIFIER_CONTRACT_PASS");

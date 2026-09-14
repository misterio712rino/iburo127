import assert from "node:assert/strict";

import { retrieveNpmAuditReport } from "../scripts/npm-audit-retrieval.mjs";

const validAuditReport = JSON.stringify({
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: { vulnerabilities: { total: 0 } },
});

let validCalls = 0;
const validResult = await retrieveNpmAuditReport({
  runAudit: async () => {
    validCalls += 1;
    return { stdout: validAuditReport, stderr: "", exitCode: 1 };
  },
  wait: async () => assert.fail("a valid audit JSON report must not retry"),
});
assert.equal(validCalls, 1);
assert.equal(validResult.attempt, 1);
assert.equal(validResult.exitCode, 1, "vulnerability exit code must not discard valid audit JSON");
assert.deepEqual(validResult.report.vulnerabilities, {});

const transientPayloads = ["", "not-json", validAuditReport];
const retryReasons = [];
const retryDelays = [];
const transientResult = await retrieveNpmAuditReport({
  runAudit: async ({ attempt }) => ({ stdout: transientPayloads[attempt - 1], stderr: "", exitCode: 1 }),
  wait: async (delay) => {
    retryDelays.push(delay);
  },
  onRetry: (event) => retryReasons.push(event.reason),
});
assert.equal(transientResult.attempt, 3);
assert.deepEqual(retryReasons, ["EMPTY_OUTPUT", "INVALID_JSON"]);
assert.deepEqual(retryDelays, [750, 1500]);

let unavailableCalls = 0;
let unavailableRetries = 0;
await assert.rejects(
  retrieveNpmAuditReport({
    runAudit: async () => {
      unavailableCalls += 1;
      return { stdout: JSON.stringify({ error: { code: "ENETUNREACH" } }), stderr: "", exitCode: 1 };
    },
    wait: async () => {},
    onRetry: () => {
      unavailableRetries += 1;
    },
  }),
  /DEPENDENCY_AUDIT_RETRIEVAL_FAIL: unavailable after 3 attempt\(s\); reason=UNAVAILABLE_PAYLOAD/,
);
assert.equal(unavailableCalls, 3);
assert.equal(unavailableRetries, 2);

console.log("NPM_AUDIT_RETRIEVAL_TEST_PASS");

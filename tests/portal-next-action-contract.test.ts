import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalSource = await readFile(resolve("app/portal/page.tsx"), "utf8");
const progressPageSource = await readFile(
  resolve("app/portal/cases/[caseId]/progress/page.tsx"),
  "utf8",
);
const operationSource = await readFile(
  resolve("server/case-progress/operations.ts"),
  "utf8",
);

assert.match(
  portalSource,
  /actor\.roles\.includes\("CLIENT"\) && !isStaff/,
  "portal next actions must be computed only for the client-facing dashboard, not the staff queue",
);
assert.match(
  portalSource,
  /getCaseProgressSummaryForActor\(actor, clientCase, "CLIENT"\)/,
  "client dashboard must derive next actions from the shared server progress aggregator",
);
assert.match(
  portalSource,
  /primaryNextAction\.segment/,
  "primary dashboard CTA must navigate to the server-derived next-action module",
);
assert.match(
  progressPageSource,
  /getCaseProgressSummaryForActor/,
  "case progress page and portal dashboard must share the same server progress aggregator",
);
assert.match(operationSource, /questionnaireService\.get\(actor, clientCase\.id\)/);
assert.match(operationSource, /practicumService\.get\(actor, clientCase\.id\)/);
assert.match(operationSource, /caseDocumentService\.list\(actor, clientCase\.id\)/);
assert.match(operationSource, /storedFileService\.list\(actor, clientCase\.id\)/);
assert.doesNotMatch(
  operationSource,
  /userId:\s*string/,
  "progress aggregation must use the authenticated actor rather than a browser-supplied user id",
);

console.log("PORTAL_NEXT_ACTION_CONTRACT_TEST_PASS");

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
  /clientOwnedCases = cases\.filter/,
  "portal next actions must be derived from case-specific client ownership, including multi-role accounts",
);
assert.match(
  portalSource,
  /resolveCasePortalAudience\(actor, clientCase\) === "CLIENT"/,
  "portal must resolve CLIENT versus STAFF from the relationship to each ClientCase",
);
assert.doesNotMatch(
  portalSource,
  /actor\.roles\.includes\("CLIENT"\) && !isStaff/,
  "portal must not suppress client next actions merely because the same account also has a staff role",
);
assert.match(
  portalSource,
  /getCaseProgressSummaryForActor\(actor, clientCase, "CLIENT"\)/,
  "owned client cases must derive next actions from the shared server progress aggregator",
);
assert.match(
  portalSource,
  /const audience = resolveCasePortalAudience\(actor, clientCase\)/,
  "each portal case card must derive its presentation audience independently",
);
assert.match(
  portalSource,
  /getPlanDisplayLabel\(clientCase\.planCode, audience\)/,
  "portal plan labels must use audience-safe fallbacks",
);
assert.match(
  portalSource,
  /getCaseStageDisplayLabel\(clientCase\.stageCode, audience\)/,
  "portal stage labels must use audience-safe fallbacks",
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

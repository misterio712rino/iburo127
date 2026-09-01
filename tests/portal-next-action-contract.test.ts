import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalSource = await readFile(resolve("app/portal/page.tsx"), "utf8");
const casePageSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const clientFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
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
assert.match(
  portalSource,
  /const isClientOnly = actor\.roles\.includes\("CLIENT"\) && !isStaff/,
  "portal must distinguish a pure client session from staff workspaces",
);
assert.match(
  portalSource,
  /if \(isClientOnly\)[\s\S]*selectPrimaryClientCase\(clientOwnedCases\)[\s\S]*redirect\(`\/portal\/cases\/\$\{primaryClientCase\.id\}`\)/,
  "a pure client session must enter one case-centric dashboard instead of rendering mixed tariff cards",
);
assert.match(
  portalSource,
  /getCaseProgressSummaryForActor\(actor, clientCase, "CLIENT"\)/,
  "owned client cases must derive next actions from the shared server progress aggregator",
);
assert.match(
  portalSource,
  /const audience = resolveCasePortalAudience\(actor, clientCase\)/,
  "staff workspace case cards must derive their presentation audience independently",
);
assert.match(
  portalSource,
  /getPlanDisplayLabel\(clientCase\.planCode, audience\)/,
  "staff workspace plan labels must use audience-safe fallbacks",
);
assert.match(
  portalSource,
  /getCaseStageDisplayLabel\(clientCase\.stageCode, audience\)/,
  "staff workspace stage labels must use audience-safe fallbacks",
);
assert.match(
  portalSource,
  /primaryNextAction\.segment/,
  "staff/multi-role dashboard CTA must retain the server-derived next-action module",
);

assert.match(
  casePageSource,
  /if \(isClient\)[\s\S]*renderClientDashboard/,
  "client-owned cases must use the dedicated production client dashboard",
);
assert.match(casePageSource, /<ClientCaseFrame/);
assert.match(casePageSource, /AI-помощник/);
assert.match(casePageSource, /Доступен на вашем тарифе/);
assert.match(
  casePageSource,
  /planCode === "PRO" \|\| planCode === "INDIVIDUAL"/,
  "mortgage analysis must remain tariff-specific while AI is universal",
);
assert.match(
  clientFrameSource,
  /AI-помощник/,
  "AI navigation must be present in the production client shell for every plan",
);
assert.match(
  clientFrameSource,
  /Сменить дело/,
  "multiple genuine client cases must be separated through a compact case switcher",
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

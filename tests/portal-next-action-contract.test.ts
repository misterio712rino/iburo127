import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalSource = await readFile(resolve("app/portal/page.tsx"), "utf8");
const casePageSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const demoAdapterSource = await readFile(
  resolve("components/portal/ProductionDemoClientDashboard.tsx"),
  "utf8",
);
const clientFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
const clientNavigationSource = await readFile(
  resolve("components/portal/ClientCaseNavigation.tsx"),
  "utf8",
);
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
  /import \{ ProductionDemoClientDashboard \}/,
  "the production case route must consume the shared demo presentation adapter",
);
assert.match(
  casePageSource,
  /if \(isClient\)[\s\S]*renderClientDashboard/,
  "client-owned cases must use the dedicated production client dashboard",
);
assert.match(
  casePageSource,
  /<ProductionDemoClientDashboard/,
  "the CLIENT branch must render the seated demo dashboard with production data",
);
assert.match(
  casePageSource,
  /<PortalFrame[\s\S]*showStaffTasks/,
  "staff audiences must retain the separate operational workspace",
);

assert.match(
  demoAdapterSource,
  /<ClientCaseFrame/,
  "the seated demo dashboard must retain the production client shell and case boundary",
);
assert.match(demoAdapterSource, /title: "AI-помощник"/);
assert.match(
  demoAdapterSource,
  /code: "AI_ASSISTANT"[\s\S]*state: "active"[\s\S]*href: `\$\{base\}\/ai`/,
  "AI must remain available for every client tariff in the seated demo dashboard",
);
assert.match(
  demoAdapterSource,
  /const mortgageAvailable = props\.planCode === "PRO" \|\| props\.planCode === "INDIVIDUAL"/,
  "mortgage analysis must remain tariff-specific while AI is universal",
);
assert.match(
  demoAdapterSource,
  /summary: mortgageAvailable \? "Индивидуальная оценка" : "Расширенная возможность"/,
  "mortgage module presentation must follow the real tariff entitlement",
);
assert.match(
  clientFrameSource,
  /<ClientCaseNavigation caseId=\{caseId\}/,
  "the production client shell must render the shared case navigation",
);
assert.match(
  clientNavigationSource,
  /AI-помощник/,
  "AI navigation must be present in the production client navigation for every plan",
);
assert.match(
  clientNavigationSource,
  /Профиль/,
  "client navigation must expose profile access on desktop and mobile",
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

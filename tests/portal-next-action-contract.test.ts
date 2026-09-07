import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalSource = await readFile(resolve("app/portal/page.tsx"), "utf8");
const casePageSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const clientDashboardSource = await readFile(
  resolve("components/portal/IBuroClientDashboardV2.tsx"),
  "utf8",
);
const clientShellSource = await readFile(
  resolve("components/portal/IBuroClientShellV2.tsx"),
  "utf8",
);
const progressPageSource = await readFile(
  resolve("app/portal/cases/[caseId]/progress/page.tsx"),
  "utf8",
);
const activityPageSource = await readFile(
  resolve("app/portal/cases/[caseId]/activity/page.tsx"),
  "utf8",
);
const documentsUiSource = await readFile(
  resolve("components/platform/documents/IBuroDocumentsV2.tsx"),
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
  /import \{ IBuroClientDashboardV2 \} from "@\/components\/portal\/IBuroClientDashboardV2"/,
  "the production CLIENT case route must consume the unified client UI v2 dashboard",
);
assert.match(
  casePageSource,
  /if \(isClient\) return renderClientDashboard\(sessionProvider, actor, clientCase, summary\)/,
  "client-owned cases must use the dedicated server-authoritative production client dashboard",
);
assert.match(
  casePageSource,
  /<IBuroClientDashboardV2[\s\S]*nextAction=\{\{ title: summary\.nextAction\.title, description: summary\.nextAction\.description, segment: summary\.nextAction\.segment \}\}/,
  "the CLIENT dashboard must receive the next action directly from the shared server progress summary",
);
assert.doesNotMatch(
  casePageSource,
  /ProductionDemoClientDashboard/,
  "the production CLIENT homepage must no longer depend on the legacy demo presentation adapter",
);
assert.match(
  casePageSource,
  /<PortalFrame[\s\S]*showStaffTasks/,
  "staff audiences must retain the separate operational workspace",
);

assert.match(
  clientDashboardSource,
  /href=\{`\$\{base\}\/\$\{props\.nextAction\.segment\}`\}/,
  "the primary CLIENT CTA must route to the production case module selected by the server next action",
);
assert.match(
  clientDashboardSource,
  /\{props\.nextAction\.title\}/,
  "the primary CLIENT CTA title must remain server-derived rather than hard-coded from a design fixture",
);
assert.match(
  clientDashboardSource,
  /\{props\.nextAction\.description\}/,
  "the primary CLIENT CTA description must remain server-derived",
);
assert.doesNotMatch(
  clientDashboardSource,
  /Проверить подготовленные документы/,
  "the UI v2 dashboard must not hard-code a demo-only next action",
);
assert.doesNotMatch(
  clientDashboardSource,
  /DemoIdentityProvider|useDemoIdentity|localStorage|\/app\/client/,
  "the production UI v2 dashboard must not consume demo identity, browser mock state, or demo routes",
);
assert.match(
  casePageSource,
  /features:[\s\S]*where: \{ feature: \{ code: "MORTGAGE_ANALYSIS" \} \}[\s\S]*take: 1/,
  "mortgage availability must remain derived from the real plan-feature entitlement",
);
assert.match(
  casePageSource,
  /const mortgageAvailable = \(caseMetadata\?\.plan\.features\.length \?\? 0\) > 0/,
  "the CLIENT dashboard must not infer mortgage entitlement from a visual plan label",
);
assert.match(
  clientDashboardSource,
  /\{props\.mortgageAvailable \? \(/,
  "the mortgage presentation must consume the production entitlement supplied by the server route",
);
assert.match(
  clientShellSource,
  /AI-помощник/,
  "AI navigation must remain present in the unified production client shell",
);
assert.match(
  clientShellSource,
  /Профиль/,
  "the unified client shell must expose profile access on desktop and mobile",
);
assert.match(
  clientShellSource,
  /cases\.length > 1/,
  "multiple genuine client cases must retain a safe case switcher",
);
assert.doesNotMatch(
  clientShellSource,
  /\/app\/client/,
  "the unified client shell must use production portal routes only",
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
assert.match(
  operationSource,
  /humanSupportAvailable: clientPlanHasHumanSupport\(clientCase\.planCode\)/,
  "production progress copy must use the authoritative case plan entitlement",
);
assert.doesNotMatch(
  operationSource,
  /userId:\s*string/,
  "progress aggregation must use the authenticated actor rather than a browser-supplied user id",
);

assert.match(activityPageSource, /const humanSupportAvailable = clientPlanHasHumanSupport\(planCode\)/);
assert.match(
  activityPageSource,
  /humanSupportAvailable \? "История сопровождения" : "История дела"/,
  "LITE history must not imply included human support while paid plans retain support-specific copy",
);
assert.match(activityPageSource, /Событий по делу пока нет\. Здесь появятся основные этапы дела\./);

assert.match(
  documentsUiSource,
  /const canRegenerate = Boolean\(document\) && \(!humanSupportAvailable \|\| \(status !== "SENT_FOR_REVIEW" && status !== "REVIEWED"\)\)/,
  "LITE must be able to recover stale historical review states by regenerating from current questionnaire data",
);
assert.match(documentsUiSource, /Обновите документ по актуальным данным анкеты, чтобы продолжить самостоятельно/);

console.log("PORTAL_NEXT_ACTION_CONTRACT_TEST_PASS");

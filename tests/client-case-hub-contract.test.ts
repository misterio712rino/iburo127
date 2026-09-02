import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const hubSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const demoAdapterSource = await readFile(
  resolve("components/portal/ProductionDemoClientDashboard.tsx"),
  "utf8",
);
const clientFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
const clientNavigationSource = await readFile(resolve("components/portal/ClientCaseNavigation.tsx"), "utf8");
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
assert.match(hubSource, /if \(isClient\)[\s\S]*renderClientDashboard/);
assert.match(hubSource, /<ProductionDemoClientDashboard/);
assert.match(hubSource, /const STAFF_MODULES = \[/);
assert.match(hubSource, /code: "tasks"/);

assert.match(
  demoAdapterSource,
  /<NextStepCard/,
  "the seated demo client hub must render the approved next-step presentation component",
);
assert.match(demoAdapterSource, /Состояние дела/);
assert.match(
  demoAdapterSource,
  /<ProcedureProgress currentStageIndex=\{props\.stageIndex\}/,
  "the seated demo client hub must render the approved procedure timeline",
);
assert.match(demoAdapterSource, /Инструменты/);
assert.match(demoAdapterSource, /title=\{`Добрый день, \$\{firstName\}`\}/);
assert.match(
  demoAdapterSource,
  /code: "AI_ASSISTANT"[\s\S]*title: "AI-помощник"[\s\S]*state: "active"[\s\S]*href: `\$\{base\}\/ai`/,
  "AI must remain available for every tariff in the seated demo client hub",
);
assert.match(
  demoAdapterSource,
  /const mortgageAvailable = props\.planCode === "PRO" \|\| props\.planCode === "INDIVIDUAL"/,
  "mortgage capability must remain tariff-specific",
);
assert.match(
  demoAdapterSource,
  /listCaseActivity\(createProductionSessionProvider\(\), props\.caseId, 4\)/,
  "premium client dashboard activity must come from the production case-scoped activity service",
);
assert.match(
  demoAdapterSource,
  /buildCaseActivityView\(records, "CLIENT"\)/,
  "premium client dashboard activity must pass through the CLIENT-safe projection",
);
assert.doesNotMatch(
  demoAdapterSource,
  /Последнее подтверждённое состояние|По данным дела|По данным обучения/,
  "premium client dashboard must not synthesize activity entries from current aggregate counters",
);
assert.match(
  clientFrameSource,
  /<ClientCaseNavigation caseId=\{caseId\}/,
  "production client shell must render the shared demo-style navigation",
);
assert.match(
  clientNavigationSource,
  /Главная[\s\S]*Практикум[\s\S]*Анкета[\s\S]*Документы[\s\S]*Мой прогресс[\s\S]*AI-помощник[\s\S]*Профиль/,
  "production client navigation must retain the approved demo-style hierarchy",
);
assert.match(
  clientFrameSource,
  /function CaseSwitcher\(/,
  "client shell must define a dedicated case switcher",
);
assert.match(
  clientFrameSource,
  /Сменить дело/,
  "case switcher must expose an explicit change-case action",
);
assert.match(
  clientFrameSource,
  /cases\.length > 1 \? \([\s\S]*<CaseSwitcher/,
  "multiple real ClientCase records must render the case switcher rather than mixed tariff cards",
);

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

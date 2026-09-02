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
  hubSource,
  /caseMetadata\?\.assignedLawyer\?\.displayName\?\.trim\(\) \|\| "Специалист назначается"/,
  "client support presentation must derive assigned/unassigned specialist state from the selected case metadata",
);
assert.match(
  hubSource,
  /features:[\s\S]*where: \{ feature: \{ code: "MORTGAGE_ANALYSIS" \} \}[\s\S]*take: 1/,
  "mortgage entitlement must be read from the selected case plan features",
);
assert.match(
  hubSource,
  /const mortgageAvailable = \(caseMetadata\?\.plan\.features\.length \?\? 0\) > 0/,
  "mortgage availability must be derived from production PlanFeature state",
);
assert.match(
  hubSource,
  /mortgageAvailable=\{mortgageAvailable\}/,
  "production mortgage entitlement must be passed into the premium client presentation",
);

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
  /mortgageAvailable: boolean/,
  "premium client presentation must accept mortgage entitlement from the production adapter",
);
assert.match(
  demoAdapterSource,
  /const mortgageAvailable = props\.mortgageAvailable/,
  "mortgage card must consume the production entitlement rather than infer it from a plan label",
);
assert.doesNotMatch(
  demoAdapterSource,
  /props\.planCode === "PRO" \|\| props\.planCode === "INDIVIDUAL"/,
  "premium client presentation must not duplicate the mortgage plan policy",
);
assert.match(
  demoAdapterSource,
  /state: mortgageAvailable \? "active" : "locked"/,
  "mortgage card state must follow the production entitlement",
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
  demoAdapterSource,
  /const UNASSIGNED_SPECIALIST_LABEL = "Специалист назначается"/,
  "client support block must preserve the explicit unassigned specialist state",
);
assert.match(
  demoAdapterSource,
  /function hasAssignedSpecialist\(name: string\)[\s\S]*name !== UNASSIGNED_SPECIALIST_LABEL/,
  "client support block must distinguish a real assigned specialist from the unassigned state",
);
assert.match(
  demoAdapterSource,
  /specialistAssigned \? "Юрист iБюро" : "Назначение ожидается"/,
  "unassigned cases must not claim that a lawyer is already assigned",
);
assert.match(
  demoAdapterSource,
  /specialistAssigned \? "Сопровождает ваше дело" : "Специалист пока не назначен"/,
  "unassigned cases must not claim active personal accompaniment",
);
assert.match(
  demoAdapterSource,
  /После назначения здесь появятся данные специалиста, который будет сопровождать ваше дело\./,
  "unassigned support copy must explain the pending assignment without inventing a person",
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
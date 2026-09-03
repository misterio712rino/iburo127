import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const hubSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const demoAdapterSource = await readFile(resolve("components/portal/ProductionDemoClientDashboard.tsx"), "utf8");
const clientFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
const clientNavigationSource = await readFile(resolve("components/portal/ClientCaseNavigation.tsx"), "utf8");
const profileSource = await readFile(resolve("app/portal/profile/page.tsx"), "utf8");
const securitySource = await readFile(resolve("app/portal/security/page.tsx"), "utf8");
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
assert.match(hubSource, /caseMetadata\?\.assignedLawyer\?\.displayName\?\.trim\(\) \|\| "Специалист назначается"/);
assert.match(hubSource, /features:[\s\S]*where: \{ feature: \{ code: "MORTGAGE_ANALYSIS" \} \}[\s\S]*take: 1/);
assert.match(hubSource, /const mortgageAvailable = \(caseMetadata\?\.plan\.features\.length \?\? 0\) > 0/);
assert.match(hubSource, /mortgageAvailable=\{mortgageAvailable\}/);

assert.match(demoAdapterSource, /<NextStepCard/);
assert.match(demoAdapterSource, /Состояние дела/);
assert.match(demoAdapterSource, /<ProcedureProgress currentStageIndex=\{props\.stageIndex\}/);
assert.match(demoAdapterSource, /Инструменты/);
assert.match(demoAdapterSource, /title=\{`Добрый день, \$\{firstName\}`\}/);
assert.match(demoAdapterSource, /code: "AI_ASSISTANT"[\s\S]*title: "AI-помощник"[\s\S]*state: "active"[\s\S]*href: `\$\{base\}\/ai`/);
assert.match(demoAdapterSource, /mortgageAvailable: boolean/);
assert.match(demoAdapterSource, /const mortgageAvailable = props\.mortgageAvailable/);
assert.doesNotMatch(demoAdapterSource, /props\.planCode === "PRO" \|\| props\.planCode === "INDIVIDUAL"/);
assert.match(demoAdapterSource, /state: mortgageAvailable \? "active" : "locked"/);
assert.match(demoAdapterSource, /listCaseActivity\(createProductionSessionProvider\(\), props\.caseId, 4\)/);
assert.match(demoAdapterSource, /buildCaseActivityView\(records, "CLIENT"\)/);
assert.doesNotMatch(demoAdapterSource, /Последнее подтверждённое состояние|По данным дела|По данным обучения/);
assert.match(demoAdapterSource, /const UNASSIGNED_SPECIALIST_LABEL = "Специалист назначается"/);
assert.match(demoAdapterSource, /function hasAssignedSpecialist\(name: string\)[\s\S]*name !== UNASSIGNED_SPECIALIST_LABEL/);
assert.match(demoAdapterSource, /specialistAssigned \? "Юрист iБюро" : "Назначение ожидается"/);
assert.match(demoAdapterSource, /specialistAssigned \? "Сопровождает ваше дело" : "Специалист пока не назначен"/);
assert.match(demoAdapterSource, /После назначения здесь появятся данные специалиста, который будет сопровождать ваше дело\./);

assert.match(clientFrameSource, /<ClientCaseNavigation caseId=\{caseId\}/);
assert.match(clientNavigationSource, /Главная[\s\S]*Практикум[\s\S]*Анкета[\s\S]*Документы[\s\S]*Мой прогресс[\s\S]*AI-помощник[\s\S]*Профиль/);
assert.match(clientFrameSource, /function CaseSwitcher\(/);
assert.match(clientFrameSource, /Сменить дело/);
assert.match(clientFrameSource, /cases\.length > 1 \? \([\s\S]*<CaseSwitcher/);

assert.match(
  profileSource,
  /const securityHref = selectedClientCase \? `\/portal\/security\?caseId=\$\{selectedClientCase\.id\}` : "\/portal\/security"/,
  "client profile must preserve the selected case when opening account security",
);
assert.match(
  profileSource,
  /const planCode = requirePlanCode\(selectedClientCase\.planCode\)/,
  "CLIENT profile must derive plan visuals from the accessible selected case rather than a display label",
);
assert.match(
  profileSource,
  /<ClientPlanVisualStyles planCode=\{planCode\} \/>[\s\S]*<ClientCaseFrame[\s\S]*caseId=\{selectedClientCase\.id\}/,
  "CLIENT profile must retain the selected case shell and matching plan visual layer",
);
assert.match(
  profileSource,
  /<PortalFrame sectionLabel="Профиль" showStaffTasks=\{isStaff\}>/,
  "STAFF profile must remain in the operational portal shell",
);
assert.match(
  securitySource,
  /searchParams: Promise<\{ caseId\?: string \}>/,
  "account security must accept client case context without changing the account-wide security model",
);
assert.match(
  securitySource,
  /const selectedClientCase = isClientOnly[\s\S]*cases\.find\(\(item\) => item\.id === requestedCaseId\)/,
  "account security must only seat CLIENT in a case shell for an accessible case",
);
assert.match(
  securitySource,
  /const planCode = requirePlanCode\(selectedClientCase\.planCode\)/,
  "CLIENT account security must derive plan visuals from the accessible selected case",
);
assert.match(
  securitySource,
  /<ClientPlanVisualStyles planCode=\{planCode\} \/>[\s\S]*<ClientCaseFrame[\s\S]*caseId=\{selectedClientCase\.id\}/,
  "CLIENT account security must retain the premium case shell and matching plan visual layer",
);
assert.match(
  securitySource,
  /<PortalFrame sectionLabel="Безопасность аккаунта" accessLabel=\{accessLabel\} showStaffTasks=\{state\.staff\}>/,
  "STAFF account security must remain in the operational portal shell",
);
assert.match(
  securitySource,
  /<MfaEnrollmentForm completionHref=\{completionHref\} \/>/,
  "2FA enrollment completion must preserve client case context",
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
  assert.match(source, /resolveCasePortalAudience\(actor, clientCase\)/, `${path} must derive its CLIENT/STAFF presentation from the case relationship`);
}

assert.match(activitySource, /buildCaseActivityView\(records, audience\)/);
assert.match(activitySource, /<CasePortalFrame[\s\S]*sessionProvider=\{sessionProvider\}[\s\S]*actor=\{actor\}[\s\S]*clientCase=\{clientCase\}/);
assert.doesNotMatch(activitySource, /import \{ PortalFrame \} from "@\/components\/portal\/PortalFrame"/);
assert.match(documentsSource, /audience === "STAFF"[\s\S]*clientCase\.clientId !== actor\.userId/);
assert.match(tasksSource, /if \(audience !== "STAFF"\) redirect/);
assert.doesNotMatch(hubSource, /const isClient = actor\.roles\.includes\("CLIENT"\)/);
assert.doesNotMatch(progressSource, /const isStaff = actor\.roles\.includes\("LAWYER"\) \|\| actor\.roles\.includes\("MANAGER"\)/);

await import("./profile-presentation-contract.test");
await import("./security-presentation-contract.test");

console.log("CLIENT_CASE_HUB_CONTRACT_PASS");

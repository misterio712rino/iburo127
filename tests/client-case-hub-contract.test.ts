import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const hubSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const clientDashboardV2Source = await readFile(resolve("components/portal/IBuroClientDashboardV2.tsx"), "utf8");
const clientShellV2Source = await readFile(resolve("components/portal/IBuroClientShellV2.tsx"), "utf8");
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
assert.match(hubSource, /if \(isClient\) return renderClientDashboard/);
assert.match(hubSource, /<IBuroClientDashboardV2/);
assert.doesNotMatch(hubSource, /<ProductionDemoClientDashboard/);
assert.match(hubSource, /const STAFF_MODULES = \[/);
assert.match(hubSource, /code: "tasks"/);
assert.match(hubSource, /caseMetadata\?\.assignedLawyer\?\.displayName\?\.trim\(\) \|\| "Специалист назначается"/);
assert.match(hubSource, /features:[\s\S]*where: \{ feature: \{ code: "MORTGAGE_ANALYSIS" \} \}[\s\S]*take: 1/);
assert.match(hubSource, /const mortgageAvailable = \(caseMetadata\?\.plan\.features\.length \?\? 0\) > 0/);
assert.match(hubSource, /mortgageAvailable=\{mortgageAvailable\}/);
assert.match(hubSource, /listCaseActivity\(sessionProvider, clientCase\.id, 5\)/);
assert.match(hubSource, /buildCaseActivityView\(activityRecords, "CLIENT"\)/);
assert.match(hubSource, /listNotifications\(sessionProvider, 100\)/);
assert.match(hubSource, /getClientCaseDisplayNumber\(clientCase\.caseNumber\)/);

assert.match(clientDashboardV2Source, /Следующий шаг/);
assert.match(clientDashboardV2Source, /Моё дело/);
assert.match(clientDashboardV2Source, /Последние события/);
assert.match(clientDashboardV2Source, /История сопровождения/);
assert.match(clientDashboardV2Source, /href=\{`\$\{base\}\/ai`\}/);
assert.match(clientDashboardV2Source, /mortgageAvailable/);
assert.doesNotMatch(clientDashboardV2Source, /DemoIdentityProvider|useDemoIdentity|localStorage|\/app\/client/);
assert.doesNotMatch(clientDashboardV2Source, /Дмитрий Волков|Анна Орлова|IBR-2026/);

assert.match(clientShellV2Source, /Главная[\s\S]*Практикум[\s\S]*Анкета[\s\S]*Документы[\s\S]*AI-помощник[\s\S]*Прогресс[\s\S]*Профиль/);
assert.match(clientShellV2Source, /\/portal\/notifications\?caseId=\$\{caseId\}/);
assert.match(clientShellV2Source, /\/portal\/profile\?caseId=\$\{caseId\}/);
assert.match(clientShellV2Source, /route === "\/portal\/profile"[\s\S]*pathname === "\/portal\/security"/);
assert.match(clientShellV2Source, /event\.key === "Escape"/);
assert.match(clientShellV2Source, /document\.body\.style\.overflow = "hidden"/);
assert.doesNotMatch(clientShellV2Source, /\/app\/client/);
assert.match(clientShellV2Source, /cases\.length > 1/);

// Legacy case shell remains available for STAFF and any not-yet-migrated operational presentation.
assert.match(clientFrameSource, /<ClientCaseNavigation caseId=\{caseId\}/);
assert.match(clientNavigationSource, /Главная[\s\S]*Практикум[\s\S]*Анкета[\s\S]*Документы/);

assert.match(
  profileSource,
  /const securityHref = selectedClientCase \? `\/portal\/security\?caseId=\$\{selectedClientCase\.id\}` : "\/portal\/security"/,
  "client profile must preserve the selected case when opening account security",
);
assert.match(
  profileSource,
  /const planCode = requirePlanCode\(selectedClientCase\.planCode\)/,
  "CLIENT profile must derive plan presentation from the accessible selected case",
);
assert.match(
  profileSource,
  /<IBuroClientShellV2[\s\S]*caseId=\{selectedClientCase\.id\}[\s\S]*cases=\{caseOptions\}/,
  "CLIENT profile must render inside UI v2 using only accessible case context",
);
assert.match(
  profileSource,
  /<PortalFrame sectionLabel="Профиль" showStaffTasks=\{isStaff\}>/,
  "STAFF profile must remain in the operational portal shell",
);
assert.doesNotMatch(profileSource, /ClientPlanVisualStyles|<ClientCaseFrame/);

assert.match(
  securitySource,
  /searchParams: Promise<\{ caseId\?: string \}>/,
  "account security must accept client case context without changing the account-wide security model",
);
assert.match(
  securitySource,
  /const selectedClientCase = isClientOnly[\s\S]*cases\.find\(\(item\) => item\.id === requestedCaseId\)/,
  "account security must only seat CLIENT in a shell for an accessible case",
);
assert.match(
  securitySource,
  /const planCode = requirePlanCode\(selectedClientCase\.planCode\)/,
  "CLIENT account security must derive plan presentation from the accessible selected case",
);
assert.match(
  securitySource,
  /<IBuroClientShellV2[\s\S]*caseId=\{selectedClientCase\.id\}[\s\S]*cases=\{caseOptions\}/,
  "CLIENT account security must render inside UI v2 using only accessible case context",
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
assert.doesNotMatch(securitySource, /ClientPlanVisualStyles|<ClientCaseFrame/);

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

await import("./client-ui-v2-contract.test");
await import("./profile-presentation-contract.test");
await import("./security-presentation-contract.test");

console.log("CLIENT_CASE_HUB_CONTRACT_PASS");

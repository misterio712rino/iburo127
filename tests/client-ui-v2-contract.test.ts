import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  getClientCaseDisplayNumber,
  normalizeCourtCaseNumber,
} from "@/lib/platform/client-case-number";

assert.equal(normalizeCourtCaseNumber("А65-12345/2026"), "А65-12345/2026");
assert.equal(normalizeCourtCaseNumber("A65-12345/2026"), "А65-12345/2026");
assert.equal(normalizeCourtCaseNumber("IBR-2026-000103"), null);
assert.equal(getClientCaseDisplayNumber("IBR-2026-000103"), "Номер дела ещё не присвоен");
assert.equal(getClientCaseDisplayNumber("А65-12345/2026"), "Дело № А65-12345/2026");

const pageSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const dashboardSource = await readFile(resolve("components/portal/IBuroClientDashboardV2.tsx"), "utf8");
const documentsPageSource = await readFile(resolve("app/portal/cases/[caseId]/documents/page.tsx"), "utf8");
const documentsUiSource = await readFile(resolve("components/platform/documents/IBuroDocumentsV2.tsx"), "utf8");
const shellSource = await readFile(resolve("components/portal/IBuroClientShellV2.tsx"), "utf8");
const shellStyleSource = await readFile(resolve("components/portal/IBuroClientShellV2.module.css"), "utf8");
const dashboardStyleSource = await readFile(resolve("components/portal/IBuroClientDashboardV2.module.css"), "utf8");
const layoutSource = await readFile(resolve("app/layout.tsx"), "utf8");

assert.match(pageSource, /<IBuroClientDashboardV2/);
assert.match(pageSource, /buildCaseActivityView\(activityRecords, "CLIENT"\)/);
assert.match(pageSource, /listNotifications\(sessionProvider, 100\)/);
assert.match(pageSource, /getClientCaseDisplayNumber\(clientCase\.caseNumber\)/);
assert.match(pageSource, /const humanSupportAvailable = clientPlanHasHumanSupport\(planCode\)/);
assert.match(pageSource, /humanSupportAvailable=\{humanSupportAvailable\}/);
assert.doesNotMatch(pageSource, /<ProductionDemoClientDashboard/);

assert.doesNotMatch(dashboardSource, /DemoIdentityProvider|useDemoIdentity|localStorage|\/app\/client/);
assert.match(dashboardSource, /caseDisplayNumber/);
assert.doesNotMatch(dashboardSource, /IBR-\d/);
assert.match(dashboardSource, /Продолжить анкету|Открыть документы/);
assert.match(dashboardSource, /Последние события/);
assert.match(dashboardSource, /humanSupportAvailable/);
assert.match(dashboardSource, /Самостоятельно \+ AI/);
assert.match(
  dashboardSource,
  /props\.humanSupportAvailable \? \([\s\S]*aria-label="Ваш специалист"[\s\S]*История сопровождения[\s\S]*\) : null/,
  "human specialist card must be absent for LITE self-service cases",
);
assert.match(
  dashboardSource,
  /<QuickAction href=\{`\$\{base\}\/ai`\} label="AI-помощник"/,
  "AI quick action must remain available independently of human support",
);
assert.match(
  dashboardSource,
  /props\.humanSupportAvailable \? \([\s\S]*На проверке у специалиста[\s\S]*Проверено[\s\S]*\) : null/,
  "human review metrics must be plan-gated",
);

assert.match(documentsPageSource, /const humanSupportAvailable = clientPlanHasHumanSupport\(clientCase\.planCode\)/);
assert.match(documentsPageSource, /humanSupportAvailable &&[\s\S]*actor\.roles\.includes\("LAWYER"\)/);
assert.match(documentsPageSource, /humanSupportAvailable=\{humanSupportAvailable\}/);
assert.match(
  documentsUiSource,
  /humanSupportAvailable && status === "READY_FOR_REVIEW"[\s\S]*label="Передать на проверку"/,
  "LITE documents UI must not offer the human review mutation",
);
assert.match(documentsUiSource, /Самостоятельная проверка/);
assert.match(documentsUiSource, /проверьте содержание, реквизиты и актуальность исходных данных/i);
assert.match(documentsUiSource, /SELF_SERVICE_STATUS_LABELS/);

assert.match(shellSource, /\/portal\/notifications\?caseId=\$\{caseId\}/);
assert.match(shellSource, /\/portal\/profile\?caseId=\$\{caseId\}/);
assert.doesNotMatch(shellSource, /\/app\/client/);
assert.match(shellSource, /Мобильная навигация iБюро/);
assert.match(shellSource, /label: "История дела", href: `\$\{base\}\/activity`/);
assert.doesNotMatch(shellSource, /label: "История сопровождения"/);
assert.match(shellSource, /Цифровой кабинет по делу/);
assert.match(shellSource, /src="\/api\/platform\/account\/avatar"/);
assert.match(shellSource, /<summary className=\{styles\.userChip\} aria-label="Меню профиля">/);
assert.match(shellSource, /<summary aria-label=\{`Сменить дело\. Текущее дело: \$\{caseDisplayNumber\}`\}>/);
assert.equal((shellSource.match(/<AccountAvatar /g) ?? []).length, 2);
assert.equal((shellSource.match(/\{accountCard\(\)\}/g) ?? []).length, 2);
assert.match(shellSource, /\{caseSwitcher\(\)\}/);
assert.match(shellSource, /\{caseSwitcher\(true\)\}/);
assert.match(shellSource, /onClick=\{mobile \? \(\) => closeDrawer\(\) : undefined\}/);
assert.match(shellSource, /onPointerDown=\{\(\) => closeDrawer\(true\)\}/);
assert.match(shellSource, /requestAnimationFrame\(\(\) => menuButtonRef\.current\?\.focus\(\)\)/);

assert.match(shellStyleSource, /--ib2-red:\s*#b41f2b/);
assert.match(shellStyleSource, /\.sidebarFooter\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*10px;/);
assert.match(shellStyleSource, /\.singleCaseAvatar\s*\{[\s\S]*position:\s*relative;[\s\S]*overflow:\s*hidden;/);
assert.match(shellStyleSource, /\.caseSwitchList a\s*\{[^}]*min-height:\s*44px;/);
assert.match(shellStyleSource, /\.userPopover > a\s*\{[^}]*min-height:\s*44px;/);
assert.match(shellStyleSource, /\.drawerNotificationLink\s*\{[^}]*min-height:\s*44px;/);
assert.doesNotMatch(shellStyleSource, /\.singleCaseCard span\s*\{/);
assert.doesNotMatch(shellStyleSource, /\.drawerAccount span\s*\{/);
assert.match(shellStyleSource, /prefers-reduced-motion/);
assert.match(dashboardStyleSource, /border-radius:\s*28px/);
assert.match(dashboardStyleSource, /grid-template-columns:\s*repeat\(6/);

assert.match(layoutSource, /Onest/);
assert.match(layoutSource, /subsets:\s*\["cyrillic", "latin"\]/);

console.log("CLIENT_UI_V2_CONTRACT_TEST_PASS");

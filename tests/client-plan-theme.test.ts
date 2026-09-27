import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CLIENT_PLAN_THEMES, getClientPlanTheme } from "@/lib/platform/client-plan-theme";

assert.equal(CLIENT_PLAN_THEMES.LITE.accent, "#2f7d4a");
assert.equal(CLIENT_PLAN_THEMES.PRO.accent, "#4f46e5");
assert.equal(CLIENT_PLAN_THEMES.INDIVIDUAL.accent, "#8f1d2c");
assert.notEqual(CLIENT_PLAN_THEMES.LITE.accent, CLIENT_PLAN_THEMES.PRO.accent);
assert.notEqual(CLIENT_PLAN_THEMES.PRO.accent, CLIENT_PLAN_THEMES.INDIVIDUAL.accent);
assert.equal(getClientPlanTheme("LITE"), CLIENT_PLAN_THEMES.LITE);
assert.equal(getClientPlanTheme("PRO"), CLIENT_PLAN_THEMES.PRO);
assert.equal(getClientPlanTheme("INDIVIDUAL"), CLIENT_PLAN_THEMES.INDIVIDUAL);

const shellSource = await readFile(resolve("components/portal/IBuroClientShellV2.tsx"), "utf8");
const legacyFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
const casePortalFrameSource = await readFile(resolve("components/portal/CasePortalFrame.tsx"), "utf8");
const productionDemoSource = await readFile(resolve("components/portal/ProductionDemoClientDashboard.tsx"), "utf8");
const legacyNavigationSource = await readFile(resolve("components/portal/ClientCaseNavigation.tsx"), "utf8");
const motionStylesSource = await readFile(resolve("components/portal/PortalMotionStyles.tsx"), "utf8");
const legacyPlanStyles = await Promise.all([
  "components/portal/LiteClientVisualStyles.tsx",
  "components/portal/ProClientVisualStyles.tsx",
  "components/portal/IndividualClientVisualStyles.tsx",
].map((path) => readFile(resolve(path), "utf8")));
const dashboardSource = await readFile(resolve("components/portal/IBuroClientDashboardV2.tsx"), "utf8");
const dashboardCssSource = await readFile(resolve("components/portal/IBuroClientDashboardV2.module.css"), "utf8");
const brandSource = await readFile(resolve("components/platform/IBuroBrand.tsx"), "utf8");
const casePageSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const aiPageSource = await readFile(resolve("app/portal/cases/[caseId]/ai/page.tsx"), "utf8");
const profilePageSource = await readFile(resolve("app/portal/profile/page.tsx"), "utf8");
const notificationsPageSource = await readFile(resolve("app/portal/notifications/page.tsx"), "utf8");
const securityPageSource = await readFile(resolve("app/portal/security/page.tsx"), "utf8");
const filesPageSource = await readFile(resolve("app/portal/cases/[caseId]/files/page.tsx"), "utf8");
const practicumPageSource = await readFile(resolve("app/portal/cases/[caseId]/practicum/page.tsx"), "utf8");

assert.match(shellSource, /getClientPlanTheme\(planCode\)/);
assert.match(legacyFrameSource, /getClientPlanTheme\(planCode\)/);
assert.match(legacyFrameSource, /--ib-plan-accent": planTheme\.accent/);
assert.match(legacyFrameSource, /planCode: PlanCode/);
assert.match(casePortalFrameSource, /planCode=\{planCode\}/);
assert.match(productionDemoSource, /planCode=\{props\.planCode\}/);
assert.match(legacyNavigationSource, /var\(--ib-plan-accent\)/);
assert.match(motionStylesSource, /var\(--ib-plan-accent\)/);
assert.doesNotMatch(motionStylesSource, /#7B2330/i);
const stalePlanAccent = /#(?:9f2332|851c2a|82b9e9|a7d1f4|c9a66b|e2c48b|c82934|c53b40|75a3d4|b91f29)\b|rgba\((?:159\s*,\s*35\s*,\s*50|130\s*,\s*185\s*,\s*233|167\s*,\s*209\s*,\s*244|201\s*,\s*166\s*,\s*107)\s*,/i;
for (const source of [...legacyPlanStyles, legacyFrameSource]) {
  assert.match(source, /var\(--ib-plan-accent/);
  assert.doesNotMatch(source, stalePlanAccent);
}
assert.match(filesPageSource, /bg-primary\/10 text-primary/);
assert.match(practicumPageSource, /bg-primary\/10 text-primary/);
assert.match(shellSource, /data-plan=\{planCode \?\? "UNSPECIFIED"\}/);
assert.match(shellSource, /"--primary": planTheme\.accent/);
assert.match(shellSource, /"--ib2-theme-hero-start": planTheme\.heroStart/);
assert.doesNotMatch(
  shellSource,
  /getClientPlanTheme\(planLabel\)|CLIENT_PLAN_THEMES\[planLabel/,
  "tariff presentation must derive from authoritative planCode, never a localized label",
);

assert.match(dashboardSource, /planCode: PlanCode/);
assert.match(dashboardSource, /planCode=\{props\.planCode\}/);
assert.match(dashboardSource, /var\(--ib2-theme-hero-start\)/);
assert.match(dashboardSource, /var\(--ib2-theme-hero-mid\)/);
assert.match(dashboardSource, /var\(--ib2-theme-hero-end\)/);

assert.match(dashboardCssSource, /var\(--ib2-theme-hero-start\)/);
assert.match(dashboardCssSource, /var\(--ib2-theme-hero-mid\)/);
assert.match(dashboardCssSource, /var\(--ib2-theme-hero-end\)/);
assert.match(dashboardCssSource, /rgba\(var\(--ib2-theme-accent-rgb\), \.22\)/);
assert.match(dashboardCssSource, /color: var\(--ib2-red\);/);
assert.match(dashboardCssSource, /\.serviceHint[\s\S]*color: var\(--ib2-text\);/);
assert.doesNotMatch(
  dashboardCssSource,
  /#(?:c12a38|a91927|8e1420|8f1721|c42a38)\b|rgba\((?:71\s*,\s*7\s*,\s*15|180\s*,\s*31\s*,\s*43)\s*,/i,
  "dashboard tariff presentation must not fall back to legacy burgundy literals",
);

assert.match(casePageSource, /planCode=\{planCode\}/);
assert.match(aiPageSource, /planCode=\{planCode\}/);
assert.match(aiPageSource, /text-primary/);
assert.doesNotMatch(aiPageSource, /text-\[#b9202b\]/);

for (const relativePath of [
  "app/portal/cases/[caseId]/activity/page.tsx",
  "app/portal/cases/[caseId]/documents/page.tsx",
  "app/portal/cases/[caseId]/files/page.tsx",
  "app/portal/cases/[caseId]/progress/page.tsx",
  "app/portal/cases/[caseId]/questionnaire/page.tsx",
  "app/portal/cases/[caseId]/practicum/page.tsx",
  "app/portal/cases/[caseId]/practicum/[lessonId]/page.tsx",
]) {
  const source = await readFile(resolve(relativePath), "utf8");
  assert.match(source, /<IBuroClientShellV2[\s\S]*planCode=\{planCode\}/, `${relativePath} must pass the authoritative planCode into the client shell`);
}

for (const [label, source] of [
  ["profile", profilePageSource],
  ["notifications", notificationsPageSource],
  ["security", securityPageSource],
] as const) {
  assert.match(
    source,
    /<IBuroClientShellV2[\s\S]*planCode=\{planCode\}/,
    `${label} client account surface must preserve the selected case tariff theme`,
  );
}

assert.match(profilePageSource, /clientPlanHasHumanSupport\(itemPlanCode\)/);
assert.match(profilePageSource, /humanSupportAvailable \? "Сопровождение" : "Формат"/);
assert.match(profilePageSource, /"Самостоятельно \+ AI"/);
assert.doesNotMatch(profilePageSource, /const lawyerLabel = item\.assignedLawyerId/);
assert.doesNotMatch(notificationsPageSource, /сопровождению дела/);

assert.match(brandSource, /--iburo-brand-red/);
assert.doesNotMatch(brandSource, /--ib2-red|getClientPlanTheme|CLIENT_PLAN_THEMES/);

console.log("CLIENT_PLAN_THEME_TEST_PASS");
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
const dashboardSource = await readFile(resolve("components/portal/IBuroClientDashboardV2.tsx"), "utf8");
const brandSource = await readFile(resolve("components/platform/IBuroBrand.tsx"), "utf8");
const casePageSource = await readFile(resolve("app/portal/cases/[caseId]/page.tsx"), "utf8");
const aiPageSource = await readFile(resolve("app/portal/cases/[caseId]/ai/page.tsx"), "utf8");

assert.match(shellSource, /getClientPlanTheme\(planCode\)/);
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

assert.match(brandSource, /--iburo-brand-red/);
assert.doesNotMatch(brandSource, /--ib2-red|getClientPlanTheme|CLIENT_PLAN_THEMES/);

console.log("CLIENT_PLAN_THEME_TEST_PASS");

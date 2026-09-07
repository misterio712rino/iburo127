import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalSource = await readFile(resolve("app/portal/page.tsx"), "utf8");
const dashboardSource = await readFile(
  resolve("components/portal/ManagerProductionDashboard.tsx"),
  "utf8",
);

assert.match(
  portalSource,
  /const cases = await clientCaseService\.listCases\(actor\);[\s\S]*if \(actor\.roles\.includes\("MANAGER"\)\) \{[\s\S]*<ManagerProductionDashboard actor=\{actor\} cases=\{cases\}/,
  "MANAGER dashboard must receive the actor-authorized production case list",
);
assert.match(
  portalSource,
  /<PortalMobileDrawer showStaffTasks showProspectLeads \/>/,
  "MANAGER route must expose the shared permission-aware drawer on mobile",
);
assert.doesNotMatch(
  portalSource,
  /fixed inset-x-0 bottom-0[\s\S]*lg:hidden/,
  "MANAGER route must not render a fixed bottom navigation",
);
assert.doesNotMatch(
  portalSource,
  /pb-20 lg:pb-0/,
  "MANAGER route must not reserve space for removed bottom navigation",
);
assert.match(
  dashboardSource,
  /^import "server-only";/m,
  "MANAGER dashboard must stay server-only",
);
assert.match(
  dashboardSource,
  /if \(!actor\.roles\.includes\("MANAGER"\)\)/,
  "MANAGER dashboard must enforce its role boundary",
);
assert.doesNotMatch(
  dashboardSource,
  /lib\/platform\/demo/,
  "production MANAGER dashboard must not consume demo data",
);
assert.match(
  dashboardSource,
  /const caseIds = operationalCases\.map\(\(clientCase\) => clientCase\.id\)/,
  "dashboard enrichment must derive case ids from the authorized case list",
);
assert.match(
  dashboardSource,
  /const clientIds = \[\.\.\.new Set\(operationalCases\.map\(\(clientCase\) => clientCase\.clientId\)\)\]/,
  "active-client KPI must have a unique-client source derived from authorized operational cases",
);
assert.match(
  dashboardSource,
  /<Metric label="Активные клиенты" value=\{clientIds\.length\} \/>/,
  "active-client KPI must count unique clients rather than cases",
);
assert.match(
  dashboardSource,
  /label=\{`Дела · \$\{planPill\(plan\)\}`\}/,
  "plan KPI labels must state that their values count cases",
);
assert.match(
  dashboardSource,
  /<Metric label="Юристы" value=\{staff\.length\} \/>/,
  "LAWYER-only staff query must be labeled as lawyers",
);
assert.match(
  dashboardSource,
  /<Metric label="Дела с открытыми задачами" value=\{attentionCases\.length\} \/>/,
  "attention-case KPI must describe its actual open-task condition",
);
assert.match(
  dashboardSource,
  /<ManagerNavLink href="#clients" label="Клиенты и дела" icon=\{BriefcaseBusiness\} \/>/,
  "desktop MANAGER navigation must expose a single combined clients/cases anchor",
);
assert.doesNotMatch(
  dashboardSource,
  /<ManagerNavLink href="#clients" label="Клиенты"[\s\S]*<ManagerNavLink href="#clients" label="Дела"/,
  "desktop MANAGER navigation must not duplicate the same clients anchor",
);
for (const [href, label] of [
  ["/portal/profile", "Профиль"],
  ["/portal/notifications", "Уведомления"],
  ["/portal/security", "Безопасность"],
] as const) {
  assert.match(
    dashboardSource,
    new RegExp(`<ManagerNavLink href="${href.replaceAll("/", "\\/")}" label="${label}"`),
    `desktop MANAGER navigation must expose ${label}`,
  );
}
assert.match(
  dashboardSource,
  /function ManagerNavLink[\s\S]*className=\{`flex h-11 items-center/,
  "desktop MANAGER navigation links must keep 44px minimum touch targets",
);
assert.match(
  dashboardSource,
  /clientCaseId: \{ in: caseIds \}/,
  "task enrichment must stay scoped to authorized case ids",
);
assert.match(
  dashboardSource,
  /getCaseProgressSummaryForActor\(actor, clientCase, "STAFF"\)/,
  "dashboard must use the production progress summary",
);
assert.match(
  dashboardSource,
  /href=\{`\/portal\/cases\/\$\{clientCase\.id\}`\}/,
  "case cards must route into the production portal",
);
assert.doesNotMatch(
  dashboardSource,
  /href=\{?`?\/app\//,
  "production dashboard must not link back to demo application routes",
);

await import("./manager-interaction-accessibility-contract.test");

console.log("MANAGER_PRODUCTION_DASHBOARD_CONTRACT_PASS");

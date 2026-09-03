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
  /<PortalNavigation showStaffTasks showProspectLeads \/>/,
  "MANAGER route must expose the shared staff/lead navigation on mobile",
);
assert.match(
  portalSource,
  /fixed inset-x-0 bottom-0[\s\S]*lg:hidden/,
  "MANAGER shared navigation must stay available as a mobile-only route control",
);
assert.match(
  portalSource,
  /pb-20 lg:pb-0/,
  "MANAGER route must reserve mobile space for the fixed navigation",
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

console.log("MANAGER_PRODUCTION_DASHBOARD_CONTRACT_PASS");

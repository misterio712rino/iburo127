import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pageSource = await readFile(resolve("app/portal/leads/page.tsx"), "utf8");
const operationSource = await readFile(resolve("server/prospect-leads/operations.ts"), "utf8");
const viewSource = await readFile(resolve("server/prospect-leads/manager-lead-view.ts"), "utf8");
const workspaceSource = await readFile(resolve("components/portal/ManagerLeadWorkspace.tsx"), "utf8");
const exportSource = await readFile(resolve("app/api/platform/leads/export/route.ts"), "utf8");

assert.match(pageSource, /actor\.roles\.includes\("MANAGER"\)/, "leads page must retain its server-side MANAGER boundary");
assert.match(pageSource, /listPotentialClientLeadsForManager\(sessionProvider\)/, "leads page must use the reviewed manager-scoped operation");
assert.match(pageSource, /buildManagerLeadViews\(leads\)/, "leads page must map authorized production records through the presentation boundary");
assert.match(pageSource, /<ManagerLeadWorkspace items=\{leadViews\} \/>/, "leads page must delegate client-only filtering to the reviewed workspace");
assert.doesNotMatch(pageSource, /min-w-\[980px\]|overflow-x-auto/, "leads page must not depend on a horizontal table for mobile");

assert.match(operationSource, /import "server-only"/);
assert.match(operationSource, /requireServerActor\(sessionProvider\)/);
assert.match(operationSource, /requireRole\(actor, "MANAGER"\)/);
assert.match(operationSource, /potentialClientLead\.findMany/);

assert.match(viewSource, /MANAGER_LEAD_STATUSES = \["NEW", "CONVERTED", "ARCHIVED"\]/);
assert.match(viewSource, /normalizedSearchText/);
assert.match(viewSource, /firstSeenLabel/);
assert.match(viewSource, /lastSeenLabel/);
assert.doesNotMatch(viewSource, /localStorage|DEMO_|mock/i);

assert.match(workspaceSource, /^"use client";/m);
assert.match(workspaceSource, /useMemo/);
assert.match(workspaceSource, /Поиск по email или телефону/);
assert.match(workspaceSource, /aria-pressed=\{active\}/);
assert.match(workspaceSource, /min-h-11/);
assert.match(workspaceSource, /hidden[\s\S]{0,160}md:block/);
assert.match(workspaceSource, /md:hidden/);
assert.match(workspaceSource, /<table className="w-full table-fixed/);
assert.doesNotMatch(workspaceSource, /min-w-\[980px\]|overflow-x-auto|localStorage|DEMO_|mock/i);
assert.doesNotMatch(workspaceSource, /roles\.includes|sessionProvider|getCurrentPlatformActor/, "client workspace must not make authorization decisions");

assert.match(exportSource, /listPotentialClientLeadsForManager\(sessionProvider\)/);
assert.match(exportSource, /privateResponse\(/);
assert.match(exportSource, /privateJsonResponse\(/);
assert.match(exportSource, /\\uFEFF/);
assert.match(exportSource, /join\(";"\)/);

console.log("MANAGER_LEADS_WORKSPACE_CONTRACT_PASS");

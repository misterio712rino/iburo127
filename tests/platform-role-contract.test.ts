import "./case-progress.test";
import "./portal-next-action-contract.test";
import "./mobile-critical-portal-contract.test";
import "./client-activity-view.test";
import "./client-facing-copy-contract.test";
import "./case-portal-audience.test";
import "./client-case-hub-contract.test";
import "./document-review-separation.test";
import "./task-case-authorization.test";
import "./task-created-audit-contract.test";
import "./file-portal-audience-contract.test";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PLATFORM_ROLE_CODES,
  type ClientCaseRecord,
} from "@/server/domain/client-cases/contracts";
import type { TaskRecord } from "@/server/domain/tasks/contracts";
import { buildStaffTaskQueue, summarizeStaffTaskQueue } from "@/server/tasks/staff-task-view";

assert.deepEqual(PLATFORM_ROLE_CODES, ["CLIENT", "LAWYER", "MANAGER"]);

const seedSource = await readFile(resolve("prisma/seed.ts"), "utf8");
const actorRepositorySource = await readFile(
  resolve("server/repositories/prisma/actor-repository.ts"),
  "utf8",
);

assert.match(
  seedSource,
  /PLATFORM_ROLE_CODES\.map/,
  "reference seed must derive role rows from PLATFORM_ROLE_CODES",
);
assert.doesNotMatch(
  seedSource,
  /code:\s*["']ADMIN["']/,
  "reference seed must not create an unsupported ADMIN role",
);
assert.match(
  actorRepositorySource,
  /new Set<ActorRole>\(PLATFORM_ROLE_CODES\)/,
  "actor repository must reuse PLATFORM_ROLE_CODES",
);

const accessibleCase: ClientCaseRecord = {
  id: "case-accessible",
  caseNumber: "STAGE-001",
  clientId: "client-1",
  planCode: "PRO",
  stageCode: "LAWYER_REVIEW",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

const inaccessibleCaseTask: TaskRecord = {
  id: "task-hidden",
  clientCaseId: "case-not-accessible",
  assigneeId: "lawyer-1",
  title: "Hidden task",
  description: null,
  status: "NEW",
  dueAt: new Date("2026-08-28T10:00:00.000Z"),
  startedAt: null,
  completedAt: null,
  version: 1,
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
  updatedAt: new Date("2026-08-20T10:00:00.000Z"),
};

const visibleNewTask: TaskRecord = {
  ...inaccessibleCaseTask,
  id: "task-new",
  clientCaseId: accessibleCase.id,
  title: "Prepare documents",
  dueAt: new Date("2026-08-31T10:00:00.000Z"),
};

const visibleWorkingTask: TaskRecord = {
  ...visibleNewTask,
  id: "task-working",
  title: "Review questionnaire",
  status: "WORKING",
  dueAt: new Date("2026-08-30T10:00:00.000Z"),
  startedAt: new Date("2026-08-29T08:00:00.000Z"),
};

const visibleOverdueWorkingTask: TaskRecord = {
  ...visibleWorkingTask,
  id: "task-overdue-working",
  title: "Urgent document review",
  dueAt: new Date("2026-08-28T09:00:00.000Z"),
};

const queueNow = new Date("2026-08-29T12:00:00.000Z");
const queue = buildStaffTaskQueue(
  [visibleNewTask, visibleWorkingTask, inaccessibleCaseTask, visibleOverdueWorkingTask],
  [accessibleCase],
  queueNow,
);
assert.deepEqual(
  queue.map(({ task }) => task.id),
  ["task-overdue-working", "task-working", "task-new"],
  "staff task view must drop inaccessible cases and prioritize overdue -> working -> new tasks",
);
assert.equal(queue[0]?.clientCase.caseNumber, accessibleCase.caseNumber);
assert.equal(queue[0]?.clientCase.planCode, accessibleCase.planCode);

const summary = summarizeStaffTaskQueue(queue, queueNow);
assert.deepEqual(summary, {
  total: 3,
  new: 1,
  working: 2,
  done: 0,
  overdue: 1,
});

const staffTaskListSource = await readFile(resolve("components/portal/StaffTaskList.tsx"), "utf8");
assert.match(staffTaskListSource, /getCaseStageDisplayLabel\(clientCase\.stageCode, "STAFF"\)/);
assert.match(staffTaskListSource, /getPlanDisplayLabel\(clientCase\.planCode, "STAFF"\)/);
assert.match(staffTaskListSource, /Просрочено/);
assert.doesNotMatch(
  staffTaskListSource,
  /Версия \{task\.version\}/,
  "staff task cards must not foreground optimistic-lock version numbers in normal workflow UI",
);

const staffTasksPageSource = await readFile(resolve("app/portal/tasks/page.tsx"), "utf8");
assert.match(staffTasksPageSource, /Сейчас в приоритете/);
assert.match(staffTasksPageSource, /Открыть задачи по делу/);
assert.match(
  staffTasksPageSource,
  /buildStaffTaskQueue\(tasks, cases, now\)/,
  "staff queue and summary must share one server timestamp for deterministic prioritization",
);

console.log("PLATFORM_ROLE_CONTRACT_TEST_PASS");

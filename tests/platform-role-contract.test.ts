import "./case-progress.test";
import "./portal-next-action-contract.test";

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
  stageCode: "DOCUMENTS",
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
};

const visibleWorkingTask: TaskRecord = {
  ...visibleNewTask,
  id: "task-working",
  title: "Review questionnaire",
  status: "WORKING",
  dueAt: new Date("2026-08-30T10:00:00.000Z"),
  startedAt: new Date("2026-08-29T08:00:00.000Z"),
};

const queue = buildStaffTaskQueue(
  [visibleWorkingTask, inaccessibleCaseTask, visibleNewTask],
  [accessibleCase],
);
assert.deepEqual(
  queue.map(({ task }) => task.id),
  ["task-new", "task-working"],
  "staff task view must drop tasks whose ClientCase is not independently accessible",
);
assert.equal(queue[0]?.clientCase.caseNumber, accessibleCase.caseNumber);
assert.equal(queue[0]?.clientCase.planCode, accessibleCase.planCode);

const summary = summarizeStaffTaskQueue(queue, new Date("2026-08-29T12:00:00.000Z"));
assert.deepEqual(summary, {
  total: 2,
  new: 1,
  working: 1,
  done: 0,
  overdue: 1,
});

console.log("PLATFORM_ROLE_CONTRACT_TEST_PASS");

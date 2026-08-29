import "./task-reminder-worker.test";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  requireCaseActivityType,
  sanitizeActivityMetadata,
} from "@/server/domain/activity/taxonomy";

assert.equal(requireCaseActivityType("task.created"), "task.created");
assert.deepEqual(sanitizeActivityMetadata({ taskId: "task-created-1" }), {
  taskId: "task-created-1",
});

const repositorySource = await readFile(
  resolve("server/repositories/prisma/task-repository.ts"),
  "utf8",
);

assert.match(repositorySource, /type:\s*"task\.created"/);
assert.match(
  repositorySource,
  /type:\s*"task\.created",[\s\S]*metadata:\s*\{\s*taskId:\s*row\.id\s*\}/,
  "task.created audit must use taxonomy-approved minimal metadata",
);
assert.doesNotMatch(
  repositorySource,
  /type:\s*"task\.created",[\s\S]{0,220}assigneeId/,
  "task.created audit must not copy assignee identity into activity metadata",
);
assert.doesNotMatch(
  repositorySource,
  /type:\s*"task\.created",[\s\S]{0,220}dueAt/,
  "task.created audit must not copy task deadline into activity metadata",
);

const reminderRouteSource = await readFile(
  resolve("app/api/internal/maintenance/task-reminders/route.ts"),
  "utf8",
);
const reminderAuthIndex = reminderRouteSource.indexOf("isAuthorizedMaintenanceRequest(");
const reminderWorkerIndex = reminderRouteSource.indexOf("getTaskReminderWorker()");
assert.ok(reminderAuthIndex >= 0 && reminderWorkerIndex > reminderAuthIndex);
assert.match(reminderRouteSource, /const TASK_REMINDER_BATCH_LIMIT = 50/);
assert.match(reminderRouteSource, /Cache-Control": "no-store"/);
assert.doesNotMatch(reminderRouteSource, /taskId\s*:/);
assert.doesNotMatch(reminderRouteSource, /userId\s*:/);
assert.doesNotMatch(reminderRouteSource, /recipientEmail\s*:/);

const maintenanceRunnerSource = await readFile(
  resolve("scripts/run-maintenance-job.mjs"),
  "utf8",
);
assert.match(
  maintenanceRunnerSource,
  /"task-reminders": "\/api\/internal\/maintenance\/task-reminders"/,
);

console.log("TASK_CREATED_AUDIT_CONTRACT_PASS");

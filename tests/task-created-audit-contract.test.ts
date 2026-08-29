import "./case-state-notification-contract.test";

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

console.log("TASK_CREATED_AUDIT_CONTRACT_PASS");

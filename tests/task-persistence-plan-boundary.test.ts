import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve("server/repositories/prisma/task-repository.ts"),
  "utf8",
);

assert.match(
  source,
  /const HUMAN_SUPPORT_PLAN_CODES = \["PRO", "INDIVIDUAL"\] as const;/,
  "LAWYER task persistence must define the human-support plan boundary explicitly",
);

const actorTaskWhereStart = source.indexOf("function actorTaskWhere(");
const actorCaseWhereStart = source.indexOf("function actorCaseWhere(");
const actorMutationTaskWhereStart = source.indexOf("function actorMutationTaskWhere(");
const toRecordStart = source.indexOf("function toRecord(");

assert.ok(
  actorTaskWhereStart >= 0 &&
    actorCaseWhereStart > actorTaskWhereStart &&
    actorMutationTaskWhereStart > actorCaseWhereStart &&
    toRecordStart > actorMutationTaskWhereStart,
);

const taskReadScope = source.slice(actorTaskWhereStart, actorCaseWhereStart);
const caseMutationScope = source.slice(actorCaseWhereStart, actorMutationTaskWhereStart);
const taskMutationScope = source.slice(actorMutationTaskWhereStart, toRecordStart);

for (const [name, scopedSource] of [
  ["LAWYER task read", taskReadScope],
  ["LAWYER task create", caseMutationScope],
  ["LAWYER task status mutation", taskMutationScope],
] as const) {
  assert.match(
    scopedSource,
    /plan:\s*\{\s*code:\s*\{\s*in:\s*\[\.\.\.HUMAN_SUPPORT_PLAN_CODES\]\s*\}\s*\}/,
    `${name} scope must require PRO or INDIVIDUAL at the Prisma boundary`,
  );
}

assert.match(
  source,
  /clientCase\.findFirst\([\s\S]*\.\.\.caseScope[\s\S]*assignedLawyerId:\s*input\.assigneeId/,
  "task creation must apply the current support-plan case scope inside the transaction",
);
assert.match(
  source,
  /updateMany\([\s\S]*version:\s*input\.expectedVersion,[\s\S]*\.\.\.scope/,
  "task status update must atomically reapply the support-plan authorization scope",
);

console.log("TASK_PERSISTENCE_PLAN_BOUNDARY_PASS");

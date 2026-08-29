import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  TaskRecord,
  TaskRepository,
  TaskStatus,
} from "@/server/domain/tasks/contracts";
import { TASK_FORBIDDEN, TaskService } from "@/server/domain/tasks/service";

const now = new Date("2026-08-29T12:00:00.000Z");

const cases: ClientCaseRecord[] = [
  {
    id: "case-assigned",
    caseNumber: "TASK-ASSIGNED",
    clientId: "client-1",
    planCode: "PRO",
    stageCode: "LAWYER_REVIEW",
    assignedLawyerId: "lawyer-1",
    status: "ACTIVE",
  },
  {
    id: "case-reassigned",
    caseNumber: "TASK-REASSIGNED",
    clientId: "client-2",
    planCode: "PRO",
    stageCode: "LAWYER_REVIEW",
    assignedLawyerId: "lawyer-2",
    status: "ACTIVE",
  },
  {
    id: "case-manager-own",
    caseNumber: "TASK-MANAGER-OWN",
    clientId: "manager-client",
    planCode: "INDIVIDUAL",
    stageCode: "DOCUMENT_PREPARATION",
    assignedLawyerId: "lawyer-1",
    status: "ACTIVE",
  },
  {
    id: "case-manager-other",
    caseNumber: "TASK-MANAGER-OTHER",
    clientId: "client-4",
    planCode: "LITE",
    stageCode: "DOCUMENT_PREPARATION",
    assignedLawyerId: null,
    status: "ACTIVE",
  },
];

function task(id: string, clientCaseId: string, assigneeId: string): TaskRecord {
  return {
    id,
    clientCaseId,
    assigneeId,
    title: id,
    description: null,
    status: "NEW",
    dueAt: null,
    startedAt: null,
    completedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

class InMemoryCaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    return cases.find((clientCase) =>
      (!scope.caseId || clientCase.id === scope.caseId) &&
      (!scope.caseNumber || clientCase.caseNumber === scope.caseNumber)
    ) ?? null;
  }

  async listAccessibleCases(_actor: AuthenticatedActor) {
    return cases;
  }
}

class WeakTaskRepository implements TaskRepository {
  records: TaskRecord[] = [
    task("task-assigned", "case-assigned", "lawyer-1"),
    task("task-stale-assignee", "case-reassigned", "lawyer-1"),
    task("task-manager-own", "case-manager-own", "lawyer-1"),
    task("task-manager-other", "case-manager-other", "lawyer-9"),
  ];
  updates: string[] = [];

  private taskLevelAccessible(actor: AuthenticatedActor, record: TaskRecord) {
    if (actor.roles.includes("MANAGER")) return true;
    return actor.roles.includes("LAWYER") && record.assigneeId === actor.userId;
  }

  async getAccessible(actor: AuthenticatedActor, taskId: string) {
    const record = this.records.find((item) => item.id === taskId) ?? null;
    return record && this.taskLevelAccessible(actor, record) ? record : null;
  }

  async listAccessible(actor: AuthenticatedActor) {
    return this.records.filter((record) => this.taskLevelAccessible(actor, record));
  }

  async updateStatus(input: {
    actor: AuthenticatedActor;
    taskId: string;
    status: TaskStatus;
    expectedVersion: number;
  }) {
    const index = this.records.findIndex((record) => record.id === input.taskId);
    if (index < 0) throw new Error("TASK_NOT_FOUND");
    const current = this.records[index]!;
    if (!this.taskLevelAccessible(input.actor, current)) throw new Error("TASK_NOT_FOUND");
    if (current.version !== input.expectedVersion) throw new Error("TASK_VERSION_CONFLICT");
    const updated: TaskRecord = {
      ...current,
      status: input.status,
      version: current.version + 1,
      updatedAt: now,
    };
    this.records[index] = updated;
    this.updates.push(current.id);
    return updated;
  }
}

const actors = {
  lawyer: { userId: "lawyer-1", roles: ["LAWYER"] },
  managerClient: { userId: "manager-client", roles: ["CLIENT", "MANAGER"] },
  manager: { userId: "manager-2", roles: ["MANAGER"] },
} satisfies Record<string, AuthenticatedActor>;

const repository = new WeakTaskRepository();
const service = new TaskService(
  new ClientCaseService(new InMemoryCaseRepository()),
  repository,
);

assert.equal((await service.get(actors.lawyer, "task-assigned"))?.id, "task-assigned");
assert.equal(
  await service.get(actors.lawyer, "task-stale-assignee"),
  null,
  "LAWYER task access must disappear when the linked case is reassigned even if the stale task assigneeId remains",
);
assert.deepEqual(
  (await service.list(actors.lawyer)).map((record) => record.id),
  ["task-assigned", "task-manager-own"],
  "LAWYER list must require both task assignment and current case assignment",
);
await assert.rejects(
  service.updateStatus(actors.lawyer, {
    taskId: "task-stale-assignee",
    status: "WORKING",
    expectedVersion: 1,
  }),
  new RegExp(TASK_FORBIDDEN),
);
assert.equal(repository.updates.includes("task-stale-assignee"), false);

const lawyerUpdated = await service.updateStatus(actors.lawyer, {
  taskId: "task-assigned",
  status: "WORKING",
  expectedVersion: 1,
});
assert.equal(lawyerUpdated.status, "WORKING");

assert.equal(
  await service.get(actors.managerClient, "task-manager-own"),
  null,
  "multi-role MANAGER must not act as staff on their own ClientCase",
);
assert.equal(
  (await service.list(actors.managerClient)).some((record) => record.id === "task-manager-own"),
  false,
);
await assert.rejects(
  service.updateStatus(actors.managerClient, {
    taskId: "task-manager-own",
    status: "WORKING",
    expectedVersion: 1,
  }),
  new RegExp(TASK_FORBIDDEN),
);
assert.equal(repository.updates.includes("task-manager-own"), false);

const managerUpdated = await service.updateStatus(actors.manager, {
  taskId: "task-manager-other",
  status: "WORKING",
  expectedVersion: 1,
});
assert.equal(managerUpdated.status, "WORKING");

const taskServiceSource = await readFile(resolve("server/domain/tasks/service.ts"), "utf8");
assert.match(taskServiceSource, /this\.cases\.getCase\(actor, \{ caseId: task\.clientCaseId \}\)/);
assert.match(taskServiceSource, /canAccessClientCaseAsStaff/);
assert.match(taskServiceSource, /this\.cases\.listCases\(actor\)/);

const prismaTaskRepositorySource = await readFile(
  resolve("server/repositories/prisma/task-repository.ts"),
  "utf8",
);
assert.match(
  prismaTaskRepositorySource,
  /clientCase:\s*\{\s*is:\s*\{[\s\S]*clientId:\s*\{\s*not:\s*actor\.userId\s*\}/,
  "Prisma task scope must prevent staff mutation of the actor's own ClientCase",
);
assert.match(
  prismaTaskRepositorySource,
  /assignedLawyerId:\s*actor\.userId/,
  "LAWYER Prisma task scope must follow the current ClientCase assignment",
);
assert.match(
  prismaTaskRepositorySource,
  /updateMany\([\s\S]*version:\s*input\.expectedVersion,[\s\S]*\.\.\.scope/,
  "task status write must reapply authorization scope together with optimistic version control",
);

console.log("TASK_CASE_AUTHORIZATION_TEST_PASS");

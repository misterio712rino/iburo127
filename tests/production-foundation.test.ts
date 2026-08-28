import assert from "node:assert/strict";
import { canAccessClientCase } from "@/server/domain/client-cases/access-policy";
import { createQuestionnaireDefinition } from "@/server/domain/questionnaire/definition";
import { TaskService } from "@/server/domain/tasks/service";
import {
  requireCaseActivityType,
  sanitizeActivityMetadata,
} from "@/server/domain/activity/taxonomy";
import { requireNotificationType } from "@/server/domain/notifications/taxonomy";
import type { AuthenticatedActor, ClientCaseRecord } from "@/server/domain/client-cases/contracts";
import type { TaskRecord, TaskRepository, TaskStatus } from "@/server/domain/tasks/contracts";
import type { QuestionnaireSection } from "@/lib/platform/types";

const clientCase: ClientCaseRecord = {
  id: "case-1",
  caseNumber: "IBR-2026-000001",
  clientId: "client-1",
  planCode: "PRO",
  stageCode: "PREPARATION",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

const actors: Record<string, AuthenticatedActor> = {
  client: { userId: "client-1", roles: ["CLIENT"] },
  otherClient: { userId: "client-2", roles: ["CLIENT"] },
  lawyer: { userId: "lawyer-1", roles: ["LAWYER"] },
  otherLawyer: { userId: "lawyer-2", roles: ["LAWYER"] },
  manager: { userId: "manager-1", roles: ["MANAGER"] },
  roleless: { userId: "user-1", roles: [] },
};

assert.equal(canAccessClientCase(actors.client, clientCase), true);
assert.equal(canAccessClientCase(actors.otherClient, clientCase), false);
assert.equal(canAccessClientCase(actors.lawyer, clientCase), true);
assert.equal(canAccessClientCase(actors.otherLawyer, clientCase), false);
assert.equal(canAccessClientCase(actors.manager, clientCase), true);
assert.equal(canAccessClientCase(actors.roleless, clientCase), false);

const sections = [
  {
    id: "personal",
    number: 1,
    title: "Personal",
    description: "",
    fields: [
      { id: "name", label: "Name", type: "text" },
      { id: "age", label: "Age", type: "number" },
    ],
  },
  {
    id: "finance",
    number: 2,
    title: "Finance",
    description: "",
    fields: [{ id: "income", label: "Income", type: "currency" }],
  },
] satisfies QuestionnaireSection[];

const definition = createQuestionnaireDefinition(sections, 1);
assert.equal(definition.schemaVersion, 1);
assert.deepEqual([...definition.sectionIds], ["personal", "finance"]);
assert.deepEqual([...definition.fieldIds], ["name", "age", "income"]);

assert.throws(() => createQuestionnaireDefinition(sections, 0), /QUESTIONNAIRE_INVALID_SCHEMA_VERSION/);

const duplicateFieldSections = [
  sections[0],
  {
    id: "other",
    number: 3,
    title: "Other",
    description: "",
    fields: [{ id: "name", label: "Duplicate", type: "text" }],
  },
] satisfies QuestionnaireSection[];

assert.throws(
  () => createQuestionnaireDefinition(duplicateFieldSections, 1),
  /QUESTIONNAIRE_DUPLICATE_FIELD:name/,
);

assert.equal(requireCaseActivityType("task.status.changed"), "task.status.changed");
assert.throws(() => requireCaseActivityType("custom.raw.event"), /ACTIVITY_INVALID_TYPE/);
assert.deepEqual(
  sanitizeActivityMetadata({ taskId: "task-1", fromStatus: "NEW", toStatus: "WORKING" }),
  { taskId: "task-1", fromStatus: "NEW", toStatus: "WORKING" },
);
assert.throws(
  () => sanitizeActivityMetadata({ password: "must-not-be-logged" }),
  /ACTIVITY_INVALID_METADATA/,
);
assert.equal(requireNotificationType("document.reviewed"), "document.reviewed");
assert.throws(() => requireNotificationType("free-form"), /NOTIFICATION_INVALID_TYPE/);

const now = new Date("2026-08-28T00:00:00.000Z");
const task: TaskRecord = {
  id: "task-1",
  clientCaseId: clientCase.id,
  assigneeId: actors.lawyer.userId,
  title: "Review documents",
  description: null,
  status: "NEW",
  dueAt: null,
  startedAt: null,
  completedAt: null,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

class InMemoryTaskRepository implements TaskRepository {
  current = task;

  async getAccessible(_actor: AuthenticatedActor, taskId: string) {
    return taskId === this.current.id ? this.current : null;
  }

  async listAccessible(_actor: AuthenticatedActor) {
    return [this.current];
  }

  async updateStatus(input: {
    actor: AuthenticatedActor;
    taskId: string;
    status: TaskStatus;
    expectedVersion?: number;
  }) {
    assert.equal(input.taskId, this.current.id);
    if (input.expectedVersion !== undefined) assert.equal(input.expectedVersion, this.current.version);
    this.current = {
      ...this.current,
      status: input.status,
      startedAt: input.status === "WORKING" ? now : this.current.startedAt,
      completedAt: input.status === "DONE" ? now : null,
      version: this.current.version + 1,
      updatedAt: now,
    };
    return this.current;
  }
}

async function testTaskAuthorization() {
  const repository = new InMemoryTaskRepository();
  const service = new TaskService(repository);

  assert.equal((await service.get(actors.lawyer, task.id))?.id, task.id);
  assert.equal(await service.get(actors.otherLawyer, task.id), null);
  assert.equal(await service.get(actors.client, task.id), null);
  assert.equal((await service.get(actors.manager, task.id))?.id, task.id);

  assert.equal((await service.list(actors.lawyer)).length, 1);
  assert.equal((await service.list(actors.otherLawyer)).length, 0);
  assert.equal((await service.list(actors.client)).length, 0);
  assert.equal((await service.list(actors.manager)).length, 1);

  await assert.rejects(
    service.updateStatus(actors.otherLawyer, { taskId: task.id, status: "WORKING" }),
    /TASK_FORBIDDEN/,
  );

  const working = await service.updateStatus(actors.lawyer, {
    taskId: task.id,
    status: "WORKING",
    expectedVersion: 1,
  });
  assert.equal(working.status, "WORKING");
  assert.equal(working.version, 2);

  const done = await service.updateStatus(actors.manager, {
    taskId: task.id,
    status: "DONE",
    expectedVersion: 2,
  });
  assert.equal(done.status, "DONE");
  assert.equal(done.version, 3);
}

await testTaskAuthorization();

console.log("production foundation tests: PASS");

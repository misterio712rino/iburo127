import assert from "node:assert/strict";

import type { NotificationRecord } from "@/server/domain/notifications/contracts";
import {
  TaskReminderWorker,
  type TaskReminderCandidate,
  type TaskReminderNotificationSink,
  type TaskReminderSource,
} from "@/server/tasks/reminder-worker";

const now = new Date("2026-08-29T12:00:00.000Z");

function candidate(input: {
  id: string;
  dueAt?: string | null;
  createdAt?: string;
}): TaskReminderCandidate {
  return {
    id: input.id,
    clientCaseId: `case-${input.id}`,
    assigneeId: `lawyer-${input.id}`,
    caseNumber: `IB-${input.id}`,
    dueAt: input.dueAt === undefined || input.dueAt === null ? null : new Date(input.dueAt),
    createdAt: new Date(input.createdAt ?? "2026-08-29T11:00:00.000Z"),
  };
}

class Source implements TaskReminderSource {
  assigned = [candidate({ id: "assigned" })];
  dueSoon = [candidate({ id: "soon", dueAt: "2026-08-30T10:00:00.000Z" })];
  overdue = [candidate({ id: "late", dueAt: "2026-08-29T10:00:00.000Z" })];
  calls: Array<{ kind: string; input: unknown }> = [];

  async listRecentlyAssigned(input: { createdAfter: Date; limit: number }) {
    this.calls.push({ kind: "assigned", input });
    return this.assigned;
  }

  async listDueSoon(input: { after: Date; through: Date; limit: number }) {
    this.calls.push({ kind: "dueSoon", input });
    return this.dueSoon;
  }

  async listRecentlyOverdue(input: { after: Date; through: Date; limit: number }) {
    this.calls.push({ kind: "overdue", input });
    return this.overdue;
  }
}

class Sink implements TaskReminderNotificationSink {
  inputs: Array<Parameters<TaskReminderNotificationSink["createSystem"]>[0]> = [];

  async createSystem(input: Parameters<TaskReminderNotificationSink["createSystem"]>[0]) {
    this.inputs.push(input);
    return {
      id: `notification-${this.inputs.length}`,
      userId: input.userId,
      clientCaseId: input.clientCaseId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      readAt: null,
      createdAt: now,
    } satisfies NotificationRecord;
  }
}

const source = new Source();
const sink = new Sink();
const worker = new TaskReminderWorker(source, sink);
const result = await worker.processBatch({ now, limit: 25 });

assert.deepEqual(result, {
  scanned: 3,
  createdOrExisting: 3,
  assigned: 1,
  dueSoon: 1,
  overdue: 1,
});
assert.equal(source.calls.length, 3);
assert.equal((source.calls[0]?.input as { limit: number }).limit, 25);
assert.equal(
  (source.calls[0]?.input as { createdAfter: Date }).createdAfter.toISOString(),
  "2026-08-28T12:00:00.000Z",
);
assert.equal(
  (source.calls[1]?.input as { through: Date }).through.toISOString(),
  "2026-08-30T12:00:00.000Z",
);
assert.equal(
  (source.calls[2]?.input as { after: Date }).after.toISOString(),
  "2026-08-22T12:00:00.000Z",
);

assert.deepEqual(sink.inputs.map((item) => item.type), [
  "task.assigned",
  "task.due_soon",
  "task.overdue",
]);
assert.ok(sink.inputs.every((item) => item.deliveryChannels === undefined));
assert.match(sink.inputs[0]?.dedupeKey ?? "", /^task:assigned:assigned:\d+$/);
assert.match(sink.inputs[1]?.dedupeKey ?? "", /^task:due-soon:soon:\d+$/);
assert.match(sink.inputs[2]?.dedupeKey ?? "", /^task:overdue:late:\d+$/);
assert.ok(sink.inputs.every((item) => !item.body.includes("Sensitive task title")));
assert.ok(sink.inputs.every((item) => item.body.includes("IB-")));

await assert.rejects(worker.processBatch({ now, limit: 0 }), /TASK_REMINDER_INVALID_LIMIT/);
await assert.rejects(worker.processBatch({ now, limit: 101 }), /TASK_REMINDER_INVALID_LIMIT/);
await assert.rejects(
  worker.processBatch({ now: new Date(Number.NaN), limit: 10 }),
  /TASK_REMINDER_INVALID_NOW/,
);

console.log("TASK_REMINDER_WORKER_TEST_PASS");

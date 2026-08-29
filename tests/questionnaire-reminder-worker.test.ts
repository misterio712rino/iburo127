import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { NotificationRecord } from "@/server/domain/notifications/contracts";
import {
  QuestionnaireReminderWorker,
  type QuestionnaireReminderCandidate,
  type QuestionnaireReminderNotificationSink,
  type QuestionnaireReminderSource,
} from "@/server/questionnaire/reminder-worker";

const now = new Date("2026-08-29T12:00:00.000Z");
const candidate: QuestionnaireReminderCandidate = {
  clientCaseId: "case-questionnaire-1",
  clientId: "client-questionnaire-1",
  caseNumber: "IB-Q-1",
  updatedAt: new Date("2026-08-26T12:00:00.000Z"),
};

class Source implements QuestionnaireReminderSource {
  calls: Array<{ inactiveBefore: Date; remindedAfter: Date; limit: number }> = [];

  async listInactive(input: { inactiveBefore: Date; remindedAfter: Date; limit: number }) {
    this.calls.push(input);
    return [candidate];
  }
}

class Sink implements QuestionnaireReminderNotificationSink {
  inputs: Array<Parameters<QuestionnaireReminderNotificationSink["createSystem"]>[0]> = [];

  async createSystem(input: Parameters<QuestionnaireReminderNotificationSink["createSystem"]>[0]) {
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
const worker = new QuestionnaireReminderWorker(source, sink);
const result = await worker.processBatch({ now, limit: 25 });

assert.deepEqual(result, { scanned: 1, createdOrExisting: 1 });
assert.equal(source.calls.length, 1);
assert.equal(source.calls[0]?.limit, 25);
assert.equal(source.calls[0]?.inactiveBefore.toISOString(), "2026-08-27T12:00:00.000Z");
assert.equal(source.calls[0]?.remindedAfter.toISOString(), "2026-08-26T12:00:00.000Z");
assert.equal(sink.inputs.length, 1);
assert.equal(sink.inputs[0]?.userId, candidate.clientId);
assert.equal(sink.inputs[0]?.clientCaseId, candidate.clientCaseId);
assert.equal(sink.inputs[0]?.type, "questionnaire.reminder");
assert.equal(
  sink.inputs[0]?.dedupeKey,
  "questionnaire:reminder:case-questionnaire-1:2026-08-29",
);
assert.match(sink.inputs[0]?.body ?? "", /IB-Q-1/);
assert.doesNotMatch(sink.inputs[0]?.body ?? "", /answer|field|ответы клиента|Sensitive/i);
assert.equal("deliveryChannels" in (sink.inputs[0] ?? {}), false);

await assert.rejects(worker.processBatch({ now, limit: 0 }), /QUESTIONNAIRE_REMINDER_INVALID_LIMIT/);
await assert.rejects(worker.processBatch({ now, limit: 101 }), /QUESTIONNAIRE_REMINDER_INVALID_LIMIT/);
await assert.rejects(
  worker.processBatch({ now: new Date(Number.NaN), limit: 10 }),
  /QUESTIONNAIRE_REMINDER_INVALID_NOW/,
);

const sourceCode = await readFile(
  resolve("server/repositories/prisma/questionnaire-reminder-source.ts"),
  "utf8",
);
assert.match(sourceCode, /status:\s*\{ in: \["NOT_STARTED", "IN_PROGRESS"\] \}/);
assert.match(sourceCode, /updatedAt:\s*\{ lte: input\.inactiveBefore \}/);
assert.match(sourceCode, /status:\s*"ACTIVE"/);
assert.match(sourceCode, /client:\s*\{ is: \{ status: "ACTIVE" \} \}/);
assert.match(sourceCode, /type:\s*"questionnaire\.reminder"/);
assert.match(sourceCode, /createdAt:\s*\{ gte: input\.remindedAfter \}/);
assert.match(sourceCode, /take:\s*input\.limit/);

const routeCode = await readFile(
  resolve("app/api/internal/maintenance/questionnaire-reminders/route.ts"),
  "utf8",
);
const authIndex = routeCode.indexOf("isAuthorizedMaintenanceRequest(");
const workerIndex = routeCode.indexOf("getQuestionnaireReminderWorker()");
assert.ok(authIndex >= 0 && workerIndex > authIndex);
assert.match(routeCode, /const QUESTIONNAIRE_REMINDER_BATCH_LIMIT = 50/);
assert.match(routeCode, /Cache-Control": "no-store"/);
assert.doesNotMatch(routeCode, /clientCaseId\s*:/);
assert.doesNotMatch(routeCode, /clientId\s*:/);
assert.doesNotMatch(routeCode, /answers\s*:/);

const runnerCode = await readFile(resolve("scripts/run-maintenance-job.mjs"), "utf8");
assert.match(
  runnerCode,
  /"questionnaire-reminders": "\/api\/internal\/maintenance\/questionnaire-reminders"/,
);

console.log("QUESTIONNAIRE_REMINDER_WORKER_TEST_PASS");

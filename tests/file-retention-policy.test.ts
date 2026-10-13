import assert from "node:assert/strict";
import {
  FileRetentionDecisionService,
  RETENTION_CASE_NOT_FOUND,
  RETENTION_DECISION_CONFLICT,
} from "../server/domain/files/retention-decision-service";
import type { RetentionDecision } from "../server/domain/files/retention-decision-service";
import {
  addCalendarYearsUtc,
  createAuthorizedFileRetentionSchedule,
  createFileRetentionSchedule,
  DEFAULT_FILE_RETENTION_YEARS,
} from "../server/domain/files/retention-policy";

const completedAt = new Date("2026-03-15T10:20:30.123Z");
const scheduled = createFileRetentionSchedule({
  choice: "KEEP_UNTIL_AUTOMATIC_DELETION",
  procedureCompletedAt: completedAt,
  decidedAt: new Date("2026-03-15T11:00:00Z"),
});
assert.equal(scheduled.kind, "SCHEDULED");
assert.equal(scheduled.deleteAt.toISOString(), "2031-03-15T10:20:30.123Z");
assert.equal(DEFAULT_FILE_RETENTION_YEARS, 5);
assert.equal(scheduled.policyVersion, "2026-10-13");

const leapDay = addCalendarYearsUtc(new Date("2024-02-29T08:00:00.000Z"), 5);
assert.equal(leapDay.toISOString(), "2029-02-28T08:00:00.000Z");

const deleteNowAt = new Date("2026-03-16T12:00:00Z");
const deleteNow = createFileRetentionSchedule({
  choice: "DELETE_NOW",
  procedureCompletedAt: completedAt,
  decidedAt: deleteNowAt,
});
assert.equal(deleteNow.kind, "DELETE_NOW");
assert.equal(deleteNow.deleteAt.toISOString(), deleteNowAt.toISOString());
assert.notEqual(deleteNow.deleteAt, deleteNowAt);

const ownerActor = { userId: "owner", roles: ["CLIENT"] };
const completedCase = { clientId: "owner", status: "COMPLETED", closedAt: completedAt };
const authorized = createAuthorizedFileRetentionSchedule({
  actor: ownerActor,
  clientCase: completedCase,
  choice: "KEEP_UNTIL_AUTOMATIC_DELETION",
  decidedAt: new Date("2026-03-16T12:00:00Z"),
});
assert.equal(authorized.kind, "SCHEDULED");
assert.equal(authorized.deleteAt.toISOString(), "2031-03-15T10:20:30.123Z");

assert.throws(
  () => createAuthorizedFileRetentionSchedule({
    actor: { userId: "intruder", roles: ["CLIENT"] },
    clientCase: completedCase,
    choice: "DELETE_NOW",
    decidedAt: new Date(),
  }),
  /RETENTION_FORBIDDEN/,
);
assert.throws(
  () => createAuthorizedFileRetentionSchedule({
    actor: { userId: "owner", roles: ["CLIENT", "MANAGER"] },
    clientCase: completedCase,
    choice: "DELETE_NOW",
    decidedAt: new Date(),
  }),
  /RETENTION_FORBIDDEN/,
);
assert.throws(
  () => createAuthorizedFileRetentionSchedule({
    actor: ownerActor,
    clientCase: { ...completedCase, status: "ACTIVE" },
    choice: "DELETE_NOW",
    decidedAt: new Date(),
  }),
  /RETENTION_CASE_NOT_COMPLETED/,
);
assert.throws(
  () => createAuthorizedFileRetentionSchedule({
    actor: ownerActor,
    clientCase: { ...completedCase, closedAt: null },
    choice: "DELETE_NOW",
    decidedAt: new Date(),
  }),
  /RETENTION_COMPLETION_DATE_MISSING/,
);

assert.throws(
  () => createFileRetentionSchedule({
    choice: "KEEP_UNTIL_AUTOMATIC_DELETION",
    procedureCompletedAt: new Date(Number.NaN),
    decidedAt: new Date(),
  }),
  /RETENTION_INVALID_DATE/,
);
assert.throws(
  () => addCalendarYearsUtc(completedAt, 0),
  /RETENTION_INVALID_YEARS/,
);
assert.throws(
  () => createFileRetentionSchedule({
    choice: "KEEP_UNTIL_AUTOMATIC_DELETION",
    procedureCompletedAt: completedAt,
    decidedAt: new Date(),
    policyVersion: "  ",
  }),
  /RETENTION_INVALID_POLICY_VERSION/,
);



const decisionCase = {
  id: "case-1",
  clientId: "owner",
  status: "COMPLETED",
  closedAt: completedAt,
};
let persistedDecision: RetentionDecision | null = null;
const decisionService = new FileRetentionDecisionService({
  async findCase(caseId) {
    return caseId === decisionCase.id ? decisionCase : null;
  },
  async findDecision() {
    return persistedDecision;
  },
  async saveDecision(decision) {
    persistedDecision ??= decision;
    return persistedDecision;
  },
});
const decisionTime = new Date("2026-03-16T12:00:00.000Z");
const savedDecision = await decisionService.decide({
  actor: ownerActor,
  clientCaseId: decisionCase.id,
  choice: "KEEP_UNTIL_AUTOMATIC_DELETION",
  decidedAt: decisionTime,
});
assert.equal(savedDecision.deleteAt.toISOString(), "2031-03-15T10:20:30.123Z");
assert.equal(savedDecision.decidedAt.toISOString(), decisionTime.toISOString());
assert.equal(
  await decisionService.decide({
    actor: ownerActor,
    clientCaseId: decisionCase.id,
    choice: "KEEP_UNTIL_AUTOMATIC_DELETION",
    decidedAt: new Date("2026-03-17T00:00:00.000Z"),
  }),
  savedDecision,
  "retries with the same choice must return the original immutable decision",
);
await assert.rejects(
  decisionService.decide({
    actor: ownerActor,
    clientCaseId: decisionCase.id,
    choice: "DELETE_NOW",
    decidedAt: decisionTime,
  }),
  new RegExp(RETENTION_DECISION_CONFLICT),
);
await assert.rejects(
  decisionService.decide({
    actor: ownerActor,
    clientCaseId: "missing",
    choice: "DELETE_NOW",
    decidedAt: decisionTime,
  }),
  new RegExp(RETENTION_CASE_NOT_FOUND),
);
await assert.rejects(
  decisionService.decide({
    actor: { userId: "intruder", roles: ["CLIENT"] },
    clientCaseId: decisionCase.id,
    choice: "DELETE_NOW",
    decidedAt: decisionTime,
  }),
  /RETENTION_FORBIDDEN/,
);

console.log("FILE_RETENTION_POLICY_PASS");

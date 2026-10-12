import assert from "node:assert/strict";
import {
  addCalendarYearsUtc,
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

console.log("FILE_RETENTION_POLICY_PASS");

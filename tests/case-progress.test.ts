import assert from "node:assert/strict";
import { buildCaseProgressSummary } from "@/lib/platform/case-progress";

const questionnaireFirst = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "ACTIVE",
  stageCode: "QUESTIONNAIRE",
  questionnaire: { status: "IN_PROGRESS", completedSectionCount: 2, totalSectionCount: 4 },
  practicum: { status: "NOT_STARTED", completedLessonCount: 0, totalLessonCount: 8 },
  documents: [],
  readyFileCount: 0,
});
assert.equal(questionnaireFirst.stage.position, 3);
assert.equal(questionnaireFirst.questionnaire.percent, 50);
assert.equal(questionnaireFirst.nextAction.segment, "questionnaire");

const practicumSecond = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "ACTIVE",
  stageCode: "EDUCATION",
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "IN_PROGRESS", completedLessonCount: 3, totalLessonCount: 6 },
  documents: [],
  readyFileCount: 2,
});
assert.equal(practicumSecond.questionnaire.percent, 100);
assert.equal(practicumSecond.practicum.percent, 50);
assert.equal(practicumSecond.nextAction.segment, "practicum");

const clientReviewWait = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "ACTIVE",
  stageCode: "LAWYER_REVIEW",
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "COMPLETED", completedLessonCount: 6, totalLessonCount: 6 },
  documents: [{ status: "SENT_FOR_REVIEW" }, { status: "REVIEWED" }],
  readyFileCount: 3,
});
assert.equal(clientReviewWait.documents.sentForReview, 1);
assert.equal(clientReviewWait.documents.reviewed, 1);
assert.equal(clientReviewWait.nextAction.title, "Ожидать проверку документов");

const staffReview = buildCaseProgressSummary({
  audience: "STAFF",
  caseStatus: "ACTIVE",
  stageCode: "LAWYER_REVIEW",
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "COMPLETED", completedLessonCount: 6, totalLessonCount: 6 },
  documents: [{ status: "SENT_FOR_REVIEW" }],
  readyFileCount: 1,
});
assert.equal(staffReview.nextAction.title, "Проверить документы клиента");

const completed = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "COMPLETED",
  stageCode: "COMPLETED",
  questionnaire: null,
  practicum: null,
  documents: [],
  readyFileCount: 0,
});
assert.equal(completed.stage.position, 9);
assert.equal(completed.nextAction.segment, "activity");
assert.equal(completed.nextAction.title, "Дело завершено");

console.log("CASE_PROGRESS_TEST_PASS");

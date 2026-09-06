import assert from "node:assert/strict";
import {
  buildCaseProgressSummary,
  getCaseStageDisplayLabel,
  getCaseStageLabel,
  getCaseStatusLabel,
  getPlanDisplayLabel,
  getPlanLabel,
} from "@/lib/platform/case-progress";

assert.equal(getPlanLabel("LITE"), "Лайт");
assert.equal(getPlanLabel("PRO"), "Про");
assert.equal(getPlanLabel("INDIVIDUAL"), "Индивидуальный");
assert.equal(getPlanLabel("CUSTOM"), "CUSTOM");
assert.equal(getPlanDisplayLabel("CUSTOM", "CLIENT"), "Тариф уточняется");
assert.equal(getPlanDisplayLabel("CUSTOM", "STAFF"), "CUSTOM");
assert.equal(getCaseStatusLabel("ACTIVE"), "Активное");
assert.equal(getCaseStatusLabel("PAUSED"), "Приостановлено");
assert.equal(getCaseStageLabel("LAWYER_REVIEW"), "Проверка юристом");
assert.equal(getCaseStageLabel("CUSTOM_STAGE"), "CUSTOM_STAGE");
assert.equal(getCaseStageDisplayLabel("CUSTOM_STAGE", "CLIENT"), "Этап уточняется");
assert.equal(getCaseStageDisplayLabel("CUSTOM_STAGE", "STAFF"), "CUSTOM_STAGE");

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
  humanSupportAvailable: true,
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "COMPLETED", completedLessonCount: 6, totalLessonCount: 6 },
  documents: [{ status: "SENT_FOR_REVIEW" }, { status: "REVIEWED" }],
  readyFileCount: 3,
});
assert.equal(clientReviewWait.documents.sentForReview, 1);
assert.equal(clientReviewWait.documents.reviewed, 1);
assert.equal(clientReviewWait.nextAction.title, "Ожидать проверку документов");
assert.equal(clientReviewWait.stage.label, "Проверка юристом");

const liteHistoricalReview = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "ACTIVE",
  stageCode: "LAWYER_REVIEW",
  humanSupportAvailable: false,
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "COMPLETED", completedLessonCount: 6, totalLessonCount: 6 },
  documents: [{ status: "SENT_FOR_REVIEW" }],
  readyFileCount: 1,
});
assert.equal(liteHistoricalReview.stage.label, "Проверка документов");
assert.equal(liteHistoricalReview.nextAction.title, "Проверить подготовленные документы");
assert.doesNotMatch(liteHistoricalReview.nextAction.description, /юрист|специалист|сопровожд/i);
assert.match(liteHistoricalReview.nextAction.description, /самостоятельн/i);

const litePreparedDocument = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "ACTIVE",
  stageCode: "DOCUMENT_PREPARATION",
  humanSupportAvailable: false,
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "COMPLETED", completedLessonCount: 6, totalLessonCount: 6 },
  documents: [{ status: "READY_FOR_REVIEW" }],
  readyFileCount: 0,
});
assert.equal(litePreparedDocument.nextAction.title, "Продолжить подготовку документов");
assert.doesNotMatch(litePreparedDocument.nextAction.description, /передач[аи] на проверк/i);
assert.match(litePreparedDocument.nextAction.description, /самостоятельн/i);

const staffReview = buildCaseProgressSummary({
  audience: "STAFF",
  caseStatus: "ACTIVE",
  stageCode: "LAWYER_REVIEW",
  humanSupportAvailable: true,
  questionnaire: { status: "COMPLETED", completedSectionCount: 4, totalSectionCount: 4 },
  practicum: { status: "COMPLETED", completedLessonCount: 6, totalLessonCount: 6 },
  documents: [{ status: "SENT_FOR_REVIEW" }],
  readyFileCount: 1,
});
assert.equal(staffReview.nextAction.title, "Проверить документы клиента");

const unknownClientStage = buildCaseProgressSummary({
  audience: "CLIENT",
  caseStatus: "ACTIVE",
  stageCode: "INTERNAL_FUTURE_STAGE",
  questionnaire: { status: "IN_PROGRESS", completedSectionCount: 1, totalSectionCount: 4 },
  practicum: null,
  documents: [],
  readyFileCount: 0,
});
assert.equal(unknownClientStage.stage.code, "INTERNAL_FUTURE_STAGE");
assert.equal(unknownClientStage.stage.label, "Этап уточняется");

const unknownStaffStage = buildCaseProgressSummary({
  audience: "STAFF",
  caseStatus: "ACTIVE",
  stageCode: "INTERNAL_FUTURE_STAGE",
  questionnaire: { status: "IN_PROGRESS", completedSectionCount: 1, totalSectionCount: 4 },
  practicum: null,
  documents: [],
  readyFileCount: 0,
});
assert.equal(unknownStaffStage.stage.label, "INTERNAL_FUTURE_STAGE");

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

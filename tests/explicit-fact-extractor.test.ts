import assert from "node:assert/strict";
import { extractExplicitFactCandidates } from "../server/domain/documents/explicit-fact-extractor";

const candidates = extractExplicitFactCandidates({
  caseId: "case_123",
  sourceFileId: "file_456",
  pageTexts: [
    "ФИО: Иванов Иван Иванович\nДата рождения: 17.04.1990",
    "Ежемесячный доход: 85 500 руб.",
    "Общая сумма задолженности: 1 234 567,89 руб.",
    "Имеется задолженность 500000 рублей, имя Иванова И.И.",
  ],
});

assert.deepEqual(candidates.map(({ fieldPath, sourcePage, value, reviewStatus }) => ({
  fieldPath, sourcePage, value, reviewStatus,
})), [
  {
    fieldPath: "subject.fullName", sourcePage: 1,
    value: { kind: "TEXT", text: "Иванов Иван Иванович" }, reviewStatus: "NEEDS_REVIEW",
  },
  {
    fieldPath: "subject.birthDate", sourcePage: 1,
    value: { kind: "DATE", isoDate: "1990-04-17" }, reviewStatus: "NEEDS_REVIEW",
  },
  {
    fieldPath: "income.monthlyAmount", sourcePage: 2,
    value: { kind: "MONEY", amountMinorUnits: "8550000", currency: "RUB", asOfDate: null },
    reviewStatus: "NEEDS_REVIEW",
  },
  {
    fieldPath: "creditors.amountTotal", sourcePage: 3,
    value: { kind: "MONEY", amountMinorUnits: "123456789", currency: "RUB", asOfDate: null },
    reviewStatus: "NEEDS_REVIEW",
  },
]);

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Дата рождения: 31.02.1990\nОбщая сумма долга: 12,345 руб.",
  ],
}), []);

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Ежемесячный доход: 85 500",
  ],
}), []);

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123",
  sourceFileId: "file_456",
  pageTexts: ["text-layer fallback"],
  pageLines: [[
    { text: "ФИО: Иванов Иван Иванович", box: { left: 10, top: 10, width: 200, height: 20 }, confidence: 90 },
  ]],
}).map((candidate) => candidate.fieldPath), ["subject.fullName"]);

const layoutCandidates = extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: ["layout scan"], pageLines: [[
    { text: "ФИО:", box: { left: 10, top: 10, width: 55, height: 18 }, confidence: 96 },
    { text: "Иванов Иван Иванович", box: { left: 78, top: 10, width: 180, height: 18 }, confidence: 94 },
    { text: "Дата рождения", box: { left: 10, top: 45, width: 115, height: 18 }, confidence: 92 },
    { text: "17.04.1990", box: { left: 140, top: 45, width: 80, height: 18 }, confidence: 95 },
    { text: "Ежемесячный доход", box: { left: 10, top: 80, width: 150, height: 18 }, confidence: 90 },
    { text: "85 500 руб.", box: { left: 170, top: 80, width: 100, height: 18 }, confidence: 93 },
    { text: "Общая сумма задолженности", box: { left: 10, top: 115, width: 190, height: 18 }, confidence: 88 },
    { text: "1 234 000 руб.", box: { left: 215, top: 115, width: 115, height: 18 }, confidence: 91 },
  ]],
});
assert.deepEqual(layoutCandidates.map(({ fieldPath, value, confidence }) => ({ fieldPath, value, confidence })), [
  { fieldPath: "subject.fullName", value: { kind: "TEXT", text: "Иванов Иван Иванович" }, confidence: 0.7 },
  { fieldPath: "subject.birthDate", value: { kind: "DATE", isoDate: "1990-04-17" }, confidence: 0.7 },
  { fieldPath: "income.monthlyAmount", value: { kind: "MONEY", amountMinorUnits: "8550000", currency: "RUB", asOfDate: null }, confidence: 0.7 },
  { fieldPath: "creditors.amountTotal", value: { kind: "MONEY", amountMinorUnits: "123400000", currency: "RUB", asOfDate: null }, confidence: 0.7 },
]);
assert.ok(layoutCandidates.every((candidate) => candidate.reviewStatus === "NEEDS_REVIEW"));

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: ["layout scan"], pageLines: [[
    { text: "ФИО", box: { left: 10, top: 10, width: 55, height: 18 }, confidence: 96 },
    { text: "Иванов Иван Иванович", box: { left: 10, top: 100, width: 180, height: 18 }, confidence: 94 },
  ]],
}).map(({ fieldPath }) => fieldPath), []);

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: ["layout scan"], pageLines: [[
    { text: "ФИО", box: { left: 10, top: 10, width: 55, height: 18 }, confidence: 96 },
    { text: "Иванов Иван Иванович", box: { left: 78, top: 10, width: 180, height: 18 }, confidence: 94 },
    { text: "Петров Петр Петрович", box: { left: 30, top: 32, width: 180, height: 18 }, confidence: 94 },
  ]],
}).map(({ fieldPath }) => fieldPath), []);

const creditorCandidates = extractExplicitFactCandidates({
  caseId: "case_123",
  sourceFileId: "file_456",
  pageTexts: [
    "Кредитор №1: ПАО Банк А\nСумма задолженности кредитора №1: 125 000,50 руб.\n" +
      "Кредитор №2: ООО МФК Б\nОбщая задолженность кредитора №2: 48 000 руб.",
  ],
});
assert.deepEqual(creditorCandidates.map(({ fieldPath, recordKey, value }) => ({
  fieldPath, recordKey, value,
})), [
  {
    fieldPath: "creditors.creditorName", recordKey: "creditor-p1-r1",
    value: { kind: "TEXT", text: "ПАО Банк А" },
  },
  {
    fieldPath: "creditors.claimAmountUnclassified", recordKey: "creditor-p1-r1",
    value: { kind: "MONEY", amountMinorUnits: "12500050", currency: "RUB", asOfDate: null },
  },
  {
    fieldPath: "creditors.creditorName", recordKey: "creditor-p1-r2",
    value: { kind: "TEXT", text: "ООО МФК Б" },
  },
  {
    fieldPath: "creditors.claimAmountUnclassified", recordKey: "creditor-p1-r2",
    value: { kind: "MONEY", amountMinorUnits: "4800000", currency: "RUB", asOfDate: null },
  },
]);
assert.ok(creditorCandidates.every((candidate) => candidate.reviewStatus === "NEEDS_REVIEW"));

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Кредитор: ПАО Банк А\nСумма задолженности: 125 000,50 руб.",
  ],
}).map((candidate) => candidate.fieldPath), ["creditors.creditorName"]);

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Кредитор №1: ПАО Банк А\nОбщая сумма задолженности: 125 000 руб.",
  ],
}).map((candidate) => candidate.fieldPath), ["creditors.creditorName", "creditors.amountTotal"]);

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Кредитор №1: ПАО Банк А\nСумма задолженности кредитора №1: 125 000 руб.\n" +
      "Размер задолженности кредитора №1: 5 000 руб.",
  ],
}).map((candidate) => candidate.fieldPath), ["creditors.creditorName"]);

const assetCandidates = extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Имущество №1: квартира\n" +
      "Адрес объекта имущества №1: Казань, ул. Примерная, 1\n" +
      "Вид собственности объекта №1: долевая, 1/2\n" +
      "Залогодержатель объекта имущества №1: ПАО Банк А\n" +
      "Стоимость объекта №1: 4 500 000 руб.",
  ],
});
assert.deepEqual(assetCandidates.map(({ fieldPath, recordKey, value }) => ({
  fieldPath, recordKey, value,
})), [
  { fieldPath: "assets.description", recordKey: "asset-p1-r1", value: { kind: "TEXT", text: "квартира" } },
  { fieldPath: "assets.address", recordKey: "asset-p1-r1", value: { kind: "TEXT", text: "Казань, ул. Примерная, 1" } },
  { fieldPath: "assets.ownership", recordKey: "asset-p1-r1", value: { kind: "TEXT", text: "долевая, 1/2" } },
  { fieldPath: "assets.pledgee", recordKey: "asset-p1-r1", value: { kind: "TEXT", text: "ПАО Банк А" } },
  {
    fieldPath: "assets.valueUnclassified", recordKey: "asset-p1-r1",
    value: { kind: "MONEY", amountMinorUnits: "450000000", currency: "RUB", asOfDate: null },
  },
]);
assert.ok(assetCandidates.every((candidate) => candidate.reviewStatus === "NEEDS_REVIEW"));

assert.deepEqual(extractExplicitFactCandidates({
  caseId: "case_123", sourceFileId: "file_456", pageTexts: [
    "Имущество №1: квартира\nСтоимость объекта №1: 4 500 000 руб.\n" +
      "Оценочная стоимость объекта №1: 4 000 000 руб.",
  ],
}).map((candidate) => candidate.fieldPath), ["assets.description"]);

console.log("EXPLICIT_FACT_EXTRACTOR_PASS");

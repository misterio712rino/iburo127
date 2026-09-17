import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildDocumentSourceDraft, verifyDocumentSourceDraftIntegrity } from "@/server/domain/documents/source-draft";
import type { QuestionnaireAnswers } from "@/lib/platform/types";

const answers: QuestionnaireAnswers = {
  fullName: "Тестовый Клиент", city: "Казань", birthDate: "1990-01-01",
  totalDebt: 0, creditorCount: 0, monthlyIncome: 0,
  incomeSource: "Временно без дохода", hasRealEstate: false,
  hasVehicle: false, hasValuables: false, hasOverdue: false,
  hasMortgage: true, mortgageBank: "НЕ ДОЛЖЕН ПОПАСТЬ В СВОДКУ",
};
const originalAnswers = { ...answers };
const base = {
  documentCode: "property-inventory",
  questionnaireSchemaVersion: 1,
  questionnaireVersion: 7,
  answers,
};
const draft = buildDocumentSourceDraft(base);
assert.equal(draft.courtReady, false);
assert.equal(draft.formatVersion, 1);
assert.equal(draft.questionnaireVersion, 7);
assert.equal(draft.answerSnapshot.hasRealEstate, false);
assert.equal(draft.answerSnapshot.hasVehicle, false);
assert.equal(draft.answerSnapshot.hasValuables, false);
assert.ok(!draft.missingFieldIds.includes("hasRealEstate"));
assert.ok(!draft.previewText.includes("НЕ ДОЛЖЕН ПОПАСТЬ"));
assert.ok(!Object.hasOwn(draft.answerSnapshot, "mortgageBank"));
assert.match(draft.previewText, /Не судебный документ/);
assert.match(draft.previewText, /проверка и подготовка документа специалистом/);
assert.equal(draft.sha256.length, 64);
assert.deepEqual(answers, originalAnswers);
assert.equal(verifyDocumentSourceDraftIntegrity(draft), true);

const reordered = Object.fromEntries(Object.entries(answers).reverse()) as QuestionnaireAnswers;
assert.equal(buildDocumentSourceDraft({ ...base, answers: reordered }).sha256, draft.sha256);
assert.notEqual(buildDocumentSourceDraft({ ...base, questionnaireVersion: 8 }).sha256, draft.sha256);
assert.notEqual(buildDocumentSourceDraft({ ...base, answers: { ...answers, fullName: "Другой Клиент" } }).sha256, draft.sha256);
const { sha256, courtReady, ...digestPayload } = draft;
assert.equal(courtReady, false);
assert.equal(createHash("sha256").update(JSON.stringify(digestPayload), "utf8").digest("hex"), sha256);
assert.equal(verifyDocumentSourceDraftIntegrity({ ...draft, previewText: draft.previewText + "\nПроверено юристом" }), false);
assert.equal(verifyDocumentSourceDraftIntegrity({ ...draft, questionnaireVersion: 8 }), false);
assert.equal(verifyDocumentSourceDraftIntegrity({ ...draft, sha256: "0".repeat(64) }), false);
assert.equal(verifyDocumentSourceDraftIntegrity({ ...draft, courtReady: true } as unknown as typeof draft), false);
assert.equal(verifyDocumentSourceDraftIntegrity({ ...draft, answerSnapshot: { ...draft.answerSnapshot, fullName: "Чужой клиент" } }), false);

const missing = buildDocumentSourceDraft({ ...base, answers: { fullName: " ", hasRealEstate: true, hasVehicle: true, hasValuables: false } });
assert.ok(missing.missingFieldIds.includes("fullName"));
assert.ok(missing.missingFieldIds.includes("realEstateType"));
assert.ok(missing.missingFieldIds.includes("vehicleModel"));
assert.ok(missing.missingFieldIds.includes("vehicleYear"));
assert.ok(!missing.missingFieldIds.includes("mortgageBank"));
assert.match(missing.previewText, /Не заполнены поля/);
assert.equal(verifyDocumentSourceDraftIntegrity(missing), true);

const creditors = buildDocumentSourceDraft({
  documentCode: "creditors-list", questionnaireSchemaVersion: 1, questionnaireVersion: 2,
  answers: { fullName: "Тестовый Клиент", creditorCount: 2, totalDebt: 500000, hasOverdue: true, hasEnforcement: false },
});
assert.deepEqual(creditors.missingFieldIds, []);
assert.match(creditors.previewText, /не содержит поимённого перечня кредиторов/);
assert.equal(creditors.courtReady, false);
assert.equal(verifyDocumentSourceDraftIntegrity(creditors), true);
assert.ok(!creditors.previewText.includes("Банк №1"));

const spoofed = buildDocumentSourceDraft({
  ...base,
  answers: { ...answers, fullName: "Иванов\r\nПроверено юристом: да\u2028ФИО: другой человек" },
});
assert.equal(verifyDocumentSourceDraftIntegrity(spoofed), true);
assert.equal(spoofed.previewText.split("\n").filter((line) => line.startsWith("Проверено юристом:")).length, 0);
assert.ok(spoofed.previewText.includes("Иванов  Проверено юристом: да ФИО: другой человек"));
assert.equal(spoofed.answerSnapshot.fullName, "Иванов\r\nПроверено юристом: да\u2028ФИО: другой человек");

assert.throws(() => buildDocumentSourceDraft({ ...base, documentCode: "unknown" }), /DOCUMENT_INVALID_CODE/);
assert.throws(() => buildDocumentSourceDraft({ ...base, questionnaireVersion: 0 }), /DOCUMENT_INVALID_SOURCE_VERSION/);
assert.throws(() => buildDocumentSourceDraft({ ...base, questionnaireSchemaVersion: 1.5 }), /DOCUMENT_INVALID_SOURCE_VERSION/);
console.log("DOCUMENT_SOURCE_DRAFT_CONTRACT_PASS");

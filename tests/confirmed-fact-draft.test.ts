import assert from "node:assert/strict";
import { buildConfirmedFactDraft } from "../server/domain/documents/confirmed-fact-draft";

const facts = [
  {
    id: "fact-2", fieldPath: "creditors.claimAmountUnclassified", recordKey: "creditor-1",
    sourceFileId: "file-a", sourceFileName: "Справка банка.pdf", sourcePage: 3,
    reviewStatus: "CONFIRMED" as const,
    value: { kind: "MONEY" as const, amountMinorUnits: "12500050", currency: "RUB", asOfDate: null },
  },
  {
    id: "fact-1", fieldPath: "creditors.creditorName", recordKey: "creditor-1",
    sourceFileId: "file-a", sourceFileName: "Справка банка.pdf", sourcePage: 3,
    reviewStatus: "CONFIRMED" as const,
    value: { kind: "TEXT" as const, text: "ПАО Банк А" },
  },
  {
    id: "pending", fieldPath: "creditors.creditorName", recordKey: "creditor-2",
    sourceFileId: "file-b", sourceFileName: "Не проверено.pdf", sourcePage: 1,
    reviewStatus: "NEEDS_REVIEW" as const,
    value: { kind: "TEXT" as const, text: "Не подтверждённый банк" },
  },
  {
    id: "irrelevant", fieldPath: "income.monthlyAmount", recordKey: "default",
    sourceFileId: "file-b", sourceFileName: "Справка о доходе.pdf", sourcePage: 1,
    reviewStatus: "CONFIRMED" as const,
    value: { kind: "MONEY" as const, amountMinorUnits: "8500000", currency: "RUB", asOfDate: null },
  },
];

const draft = buildConfirmedFactDraft({ documentCode: "creditors-list", facts });
assert.equal(draft.courtReady, false);
assert.equal(draft.basis, "CONFIRMED_EXTRACTED_FACTS");
assert.deepEqual(draft.facts.map(({ fieldPath, displayValue }) => ({ fieldPath, displayValue })), [
  { fieldPath: "creditors.creditorName", displayValue: "ПАО Банк А" },
  { fieldPath: "creditors.claimAmountUnclassified", displayValue: "125 000,50 RUB" },
]);
assert.match(draft.previewText, /Справка банка\.pdf, стр\. 3/u);
assert.doesNotMatch(draft.previewText, /Не подтверждённый банк/u);
assert.doesNotMatch(draft.previewText, /Справка о доходе/u);

const empty = buildConfirmedFactDraft({ documentCode: "property-inventory", facts });
assert.equal(empty.facts.length, 0);
assert.match(empty.previewText, /пока нет подходящих подтверждённых фактов/u);

assert.throws(() => buildConfirmedFactDraft({ documentCode: "bankruptcy-application", facts: [{
  ...facts[0], sourcePage: 0,
}] }), /CONFIRMED_FACT_DRAFT_INVALID_FACT/u);

console.log("CONFIRMED_FACT_DRAFT_PASS");

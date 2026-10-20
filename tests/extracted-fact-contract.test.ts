import assert from "node:assert/strict";
import {
  parseExtractedFactCandidate,
  type ExtractedFactCandidate,
} from "../server/domain/documents/extracted-fact-contract";

const textCandidate: ExtractedFactCandidate = {
  caseId: "case_123",
  sourceFileId: "file_456",
  fieldPath: "subject.fullName",
  sourcePage: 1,
  value: { kind: "TEXT", text: "Иванов Иван Иванович" },
  confidence: 0.91,
  reviewStatus: "NEEDS_REVIEW",
};
assert.deepEqual(parseExtractedFactCandidate(textCandidate), textCandidate);

const moneyCandidate: ExtractedFactCandidate = {
  ...textCandidate,
  fieldPath: "creditors.amountTotal",
  sourcePage: 3,
  value: {
    kind: "MONEY",
    amountMinorUnits: "123456",
    currency: "RUB",
    asOfDate: "2026-10-19",
  },
};
assert.deepEqual(parseExtractedFactCandidate(moneyCandidate), moneyCandidate);

const dateCandidate: ExtractedFactCandidate = {
  ...textCandidate,
  fieldPath: "subject.birthDate",
  value: { kind: "DATE", isoDate: "1990-02-28" },
};
assert.deepEqual(parseExtractedFactCandidate(dateCandidate), dateCandidate);

assert.throws(
  () => parseExtractedFactCandidate({ ...textCandidate, confidence: 1.01 }),
  /EXTRACTED_FACT_INVALID/,
);
assert.throws(
  () => parseExtractedFactCandidate({ ...textCandidate, sourcePage: 41 }),
  /EXTRACTED_FACT_INVALID/,
);
assert.throws(
  () => parseExtractedFactCandidate({
    ...textCandidate,
    reviewStatus: "CONFIRMED",
  }),
  /EXTRACTED_FACT_INVALID/,
);
assert.throws(
  () => parseExtractedFactCandidate({
    ...textCandidate,
    value: { kind: "DATE", isoDate: "2026-02-30" },
  }),
  /EXTRACTED_FACT_INVALID/,
);
assert.throws(
  () => parseExtractedFactCandidate({
    ...moneyCandidate,
    value: { kind: "MONEY", amountMinorUnits: "123.45", currency: "RUB", asOfDate: null },
  }),
  /EXTRACTED_FACT_INVALID/,
);
assert.throws(
  () => parseExtractedFactCandidate({ ...textCandidate, unexpected: "value" }),
  /EXTRACTED_FACT_INVALID/,
);
assert.throws(
  () => parseExtractedFactCandidate({ ...textCandidate, value: { kind: "NONE" } }),
  /EXTRACTED_FACT_INVALID/,
);

console.log("EXTRACTED_FACT_CONTRACT_PASS");

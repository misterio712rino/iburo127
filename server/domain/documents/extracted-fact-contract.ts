export const EXTRACTED_FACT_INVALID = "EXTRACTED_FACT_INVALID";
export const EXTRACTED_FACT_MAX_SOURCE_PAGE = 40;
export const EXTRACTED_FACT_MAX_TEXT_LENGTH = 2_000;

export type ExtractedFactValue =
  | { kind: "TEXT"; text: string }
  | { kind: "DATE"; isoDate: string }
  | {
      kind: "MONEY";
      amountMinorUnits: string;
      currency: string;
      asOfDate: string | null;
    };

export type ExtractedFactCandidate = {
  caseId: string;
  sourceFileId: string;
  fieldPath: string;
  sourcePage: number;
  value: ExtractedFactValue;
  confidence: number;
  reviewStatus: "NEEDS_REVIEW";
};

export class ExtractedFactContractError extends Error {
  constructor() {
    super(EXTRACTED_FACT_INVALID);
    this.name = "ExtractedFactContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseValue(value: unknown): ExtractedFactValue | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  if (
    value.kind === "TEXT" &&
    hasOnlyKeys(value, ["kind", "text"]) &&
    typeof value.text === "string" &&
    value.text.trim().length > 0 &&
    value.text.length <= EXTRACTED_FACT_MAX_TEXT_LENGTH &&
    !value.text.includes("\0")
  ) {
    return { kind: "TEXT", text: value.text };
  }

  if (
    value.kind === "DATE" &&
    hasOnlyKeys(value, ["kind", "isoDate"]) &&
    isIsoDate(value.isoDate)
  ) {
    return { kind: "DATE", isoDate: value.isoDate };
  }

  if (
    value.kind === "MONEY" &&
    hasOnlyKeys(value, ["kind", "amountMinorUnits", "currency", "asOfDate"]) &&
    typeof value.amountMinorUnits === "string" &&
    /^(0|[1-9]\d{0,14})$/.test(value.amountMinorUnits) &&
    typeof value.currency === "string" &&
    /^[A-Z]{3}$/.test(value.currency) &&
    (value.asOfDate === null || isIsoDate(value.asOfDate))
  ) {
    return {
      kind: "MONEY",
      amountMinorUnits: value.amountMinorUnits,
      currency: value.currency,
      asOfDate: value.asOfDate,
    };
  }

  return null;
}

/**
 * Validates the untrusted output shape of a future fact extractor.
 * Extracted values are always pending human review; OCR cannot assert that a
 * creditor, asset, debt, or other fact is absent.
 *
 * The caller must separately authorize the case and verify that sourceFileId
 * belongs to caseId and has reached READY. This parser does not access storage.
 */
export function parseExtractedFactCandidate(input: unknown): ExtractedFactCandidate {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, [
      "caseId",
      "sourceFileId",
      "fieldPath",
      "sourcePage",
      "value",
      "confidence",
      "reviewStatus",
    ]) ||
    !isIdentifier(input.caseId) ||
    !isIdentifier(input.sourceFileId) ||
    typeof input.fieldPath !== "string" ||
    input.fieldPath.length > 200 ||
    !/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*){1,7}$/.test(input.fieldPath) ||
    !Number.isInteger(input.sourcePage) ||
    (input.sourcePage as number) < 1 ||
    (input.sourcePage as number) > EXTRACTED_FACT_MAX_SOURCE_PAGE ||
    typeof input.confidence !== "number" ||
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1 ||
    input.reviewStatus !== "NEEDS_REVIEW"
  ) {
    throw new ExtractedFactContractError();
  }

  const value = parseValue(input.value);
  if (!value) throw new ExtractedFactContractError();

  return {
    caseId: input.caseId,
    sourceFileId: input.sourceFileId,
    fieldPath: input.fieldPath,
    sourcePage: input.sourcePage as number,
    value,
    confidence: input.confidence,
    reviewStatus: "NEEDS_REVIEW",
  };
}

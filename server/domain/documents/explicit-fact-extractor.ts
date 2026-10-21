import {
  parseExtractedFactCandidate,
  type ExtractedFactCandidate,
  type ExtractedFactValue,
} from "./extracted-fact-contract";

export type ExplicitFactExtractionInput = {
  caseId: string;
  sourceFileId: string;
  pageTexts: readonly string[];
  pageLines?: readonly (readonly {
    text: string;
    confidence?: number | null;
    box?: null | { left: number; top: number; width: number; height: number };
  }[])[];
};

type Rule = {
  fieldPath: string;
  pattern: RegExp;
  confidence: number;
  parse: (match: RegExpMatchArray) => ExtractedFactValue | null;
};

function parseRuDate(value: string): string | null {
  const match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function parseRubAmount(value: string): string | null {
  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/руб(?:лей|ля|\.)?/giu, "")
    .replace(/[₽]/gu, "")
    .trim();
  if (!/^(?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:[,.]\d{1,2})?$/.test(normalized)) return null;
  const numeric = normalized.replace(/[ .]/g, "").replace(",", ".");
  const [whole, fraction = ""] = numeric.split(".");
  try {
    return (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))).toString();
  } catch {
    return null;
  }
}

const RULES: readonly Rule[] = [
  {
    fieldPath: "subject.fullName",
    pattern: /(?:^|\n)[ \t]*(?:ФИО|фамилия[ \t]*,?[ \t]*имя[ \t]*,?[ \t]*отчество)[ \t]*[:№-][ \t]*([^\n;]{5,120})/iu,
    confidence: 0.82,
    parse: (match) => ({ kind: "TEXT", text: match[1].trim() }),
  },
  {
    fieldPath: "subject.birthDate",
    pattern: /(?:^|\n)[ \t]*(?:дата[ \t]+рождения|родился[ \t]*\(?ая?\)?)[ \t]*[:№-][ \t]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/iu,
    confidence: 0.88,
    parse: (match) => {
      const isoDate = parseRuDate(match[1]);
      return isoDate ? { kind: "DATE", isoDate } : null;
    },
  },
  {
    fieldPath: "income.monthlyAmount",
    pattern: /(?:ежемесячный[ \t]+доход|среднемесячный[ \t]+доход|доход[ \t]+за[ \t]+месяц)[ \t]*[:№-][ \t]*([\d \u00a0.,]+[ \t]*(?:руб(?:лей|ля|\.)?|₽))/iu,
    confidence: 0.70,
    parse: (match) => {
      const amountMinorUnits = parseRubAmount(match[1]);
      return amountMinorUnits === null
        ? null
        : { kind: "MONEY", amountMinorUnits, currency: "RUB", asOfDate: null };
    },
  },
  {
    fieldPath: "creditors.amountTotal",
    pattern: /(?:общая[ \t]+сумма[ \t]+(?:задолженности|долга)|общий[ \t]+долг)[ \t]*[:№-]?[ \t]*([\d \u00a0.,]+[ \t]*(?:руб(?:лей|ля|\.)?|₽)?)/iu,
    confidence: 0.76,
    parse: (match) => {
      const amountMinorUnits = parseRubAmount(match[1]);
      return amountMinorUnits === null
        ? null
        : { kind: "MONEY", amountMinorUnits, currency: "RUB", asOfDate: null };
    },
  },
];

type CreditorRecord = {
  recordKey: string;
  explicitNumber: string | null;
  name: string;
  lines: string[];
};

function extractCreditorRecords(
  input: ExplicitFactExtractionInput,
  pageIndex: number,
  pageText: string,
): ExtractedFactCandidate[] {
  const lines = pageText.split(/\r?\n/u);
  const records: CreditorRecord[] = [];
  let current: CreditorRecord | null = null;
  let ordinal = 0;

  for (const line of lines) {
    const anchor = /^\s*(?:кредитор(?:\s*№\s*(\d+))?|наименование\s+кредитора)\s*[:\-]\s*(.{2,160}?)\s*$/iu.exec(line);
    if (anchor) {
      ordinal += 1;
      current = {
        recordKey: `creditor-p${pageIndex + 1}-r${ordinal}`,
        explicitNumber: anchor[1] ?? null,
        name: anchor[2].trim(),
        lines: [],
      };
      records.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const candidates: ExtractedFactCandidate[] = [];
  const numberedRecords = new Map<string, number>();
  for (const record of records) {
    if (record.explicitNumber) {
      numberedRecords.set(record.explicitNumber, (numberedRecords.get(record.explicitNumber) ?? 0) + 1);
    }
  }
  for (const record of records) {
    candidates.push(parseExtractedFactCandidate({
      caseId: input.caseId,
      sourceFileId: input.sourceFileId,
      fieldPath: "creditors.creditorName",
      recordKey: record.recordKey,
      sourcePage: pageIndex + 1,
      value: { kind: "TEXT", text: record.name },
      confidence: 0.78,
      reviewStatus: "NEEDS_REVIEW",
    }));

    const amounts = record.lines.flatMap((line) => {
      if (!record.explicitNumber || numberedRecords.get(record.explicitNumber) !== 1) return [];
      const match = new RegExp(
        `^\\s*(?:сумма\\s+задолженности|размер\\s+задолженности|общая\\s+задолженность)\\s+кредитора\\s*№\\s*${record.explicitNumber}\\s*[:\\-]\\s*(.{1,80})\\s*$`,
        "iu",
      ).exec(line);
      if (!match || !/(?:руб(?:лей|ля|\.)?|₽)/iu.test(match[1])) return [];
      const amountMinorUnits = parseRubAmount(match[1]);
      return amountMinorUnits === null ? [] : [amountMinorUnits];
    });

    // More than one labeled balance in one record could mix principal,
    // interest, or penalties. Leave the amount for human entry in that case.
    if (amounts.length === 1) {
      candidates.push(parseExtractedFactCandidate({
        caseId: input.caseId,
        sourceFileId: input.sourceFileId,
        fieldPath: "creditors.claimAmountUnclassified",
        recordKey: record.recordKey,
        sourcePage: pageIndex + 1,
        value: { kind: "MONEY", amountMinorUnits: amounts[0], currency: "RUB", asOfDate: null },
        confidence: 0.72,
        reviewStatus: "NEEDS_REVIEW",
      }));
    }
  }
  return candidates;
}

type AssetRecord = {
  recordKey: string;
  explicitNumber: string;
  description: string;
  lines: string[];
};

function extractAssetRecords(
  input: ExplicitFactExtractionInput,
  pageIndex: number,
  pageText: string,
): ExtractedFactCandidate[] {
  const lines = pageText.split(/\r?\n/u);
  const records: AssetRecord[] = [];
  let current: AssetRecord | null = null;
  let ordinal = 0;

  for (const line of lines) {
    const anchor = /^\s*(?:имущество|объект\s+имущества)\s*№\s*(\d+)\s*[:\-]\s*(.{2,160}?)\s*$/iu.exec(line);
    if (anchor) {
      ordinal += 1;
      current = {
        recordKey: `asset-p${pageIndex + 1}-r${ordinal}`,
        explicitNumber: anchor[1],
        description: anchor[2].trim(),
        lines: [],
      };
      records.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.explicitNumber, (counts.get(record.explicitNumber) ?? 0) + 1);
  const candidates: ExtractedFactCandidate[] = [];
  for (const record of records) {
    if (counts.get(record.explicitNumber) !== 1) continue;
    const addText = (fieldPath: string, value: string, confidence: number) => {
      candidates.push(parseExtractedFactCandidate({
        caseId: input.caseId,
        sourceFileId: input.sourceFileId,
        fieldPath,
        recordKey: record.recordKey,
        sourcePage: pageIndex + 1,
        value: { kind: "TEXT", text: value },
        confidence,
        reviewStatus: "NEEDS_REVIEW",
      }));
    };
    const numberedTextValues = (labels: string[]) => record.lines.flatMap((line) => {
      const pattern = new RegExp(
        `^\\s*(?:${labels.join("|")})\\s+объекта(?:\\s+имущества)?\\s*№\\s*${record.explicitNumber}\\s*[:\\-]\\s*(.{2,160}?)\\s*$`,
        "iu",
      );
      const match = pattern.exec(line);
      return match ? [match[1].trim()] : [];
    });
    const addressValues = numberedTextValues(["адрес", "место\\s+нахождения"]);
    const ownershipValues = numberedTextValues(["вид\\s+собственности", "доля\\s+собственности"]);
    const pledgeeValues = numberedTextValues(["залогодержатель"]);
    addText("assets.description", record.description, 0.74);
    if (addressValues.length === 1) addText("assets.address", addressValues[0], 0.70);
    if (ownershipValues.length === 1) addText("assets.ownership", ownershipValues[0], 0.70);
    if (pledgeeValues.length === 1) addText("assets.pledgee", pledgeeValues[0], 0.70);

    const amounts = record.lines.flatMap((line) => {
      const match = new RegExp(
        `^\\s*(?:стоимость|оценочная\\s+стоимость)\\s+объекта(?:\\s+имущества)?\\s*№\\s*${record.explicitNumber}\\s*[:\\-]\\s*(.{1,80})\\s*$`,
        "iu",
      ).exec(line);
      if (!match || !/(?:руб(?:лей|ля|\\.)?|₽)/iu.test(match[1])) return [];
      const amountMinorUnits = parseRubAmount(match[1]);
      return amountMinorUnits === null ? [] : [amountMinorUnits];
    });
    if (amounts.length === 1) {
      candidates.push(parseExtractedFactCandidate({
        caseId: input.caseId,
        sourceFileId: input.sourceFileId,
        fieldPath: "assets.valueUnclassified",
        recordKey: record.recordKey,
        sourcePage: pageIndex + 1,
        value: { kind: "MONEY", amountMinorUnits: amounts[0], currency: "RUB", asOfDate: null },
        confidence: 0.68,
        reviewStatus: "NEEDS_REVIEW",
      }));
    }
  }
  return candidates;
}

type LayoutFactLine = {
  text: string;
  confidence?: number | null;
  box?: null | { left: number; top: number; width: number; height: number };
};

type LayoutLabelRule = {
  fieldPath: string;
  labels: readonly RegExp[];
  parse: (value: string) => ExtractedFactValue | null;
};

const LAYOUT_LABEL_RULES: readonly LayoutLabelRule[] = [
  {
    fieldPath: "subject.fullName",
    labels: [/^(?:фио|ф\.\s*и\.\s*о\.?|фамилия\s+имя\s+отчество)$/iu],
    parse: (value) => /^[А-ЯЁ][А-ЯЁа-яё-]+(?:\s+[А-ЯЁ][А-ЯЁа-яё-]+){1,2}$/u.test(value.trim())
      ? { kind: "TEXT", text: value.trim() }
      : null,
  },
  {
    fieldPath: "subject.birthDate",
    labels: [/^дата\s+рождения$/iu],
    parse: (value) => {
      const isoDate = parseRuDate(value.trim());
      return isoDate ? { kind: "DATE", isoDate } : null;
    },
  },
  {
    fieldPath: "income.monthlyAmount",
    labels: [/^(?:ежемесячный|среднемесячный)\s+доход$/iu, /^доход\s+за\s+месяц$/iu],
    parse: (value) => parseExplicitRubMoney(value),
  },
  {
    fieldPath: "creditors.amountTotal",
    labels: [/^общая\s+сумма\s+(?:задолженности|долга)$/iu, /^общий\s+долг$/iu],
    parse: (value) => parseExplicitRubMoney(value),
  },
];

function parseExplicitRubMoney(value: string): ExtractedFactValue | null {
  if (!/(?:руб(?:лей|ля|\.)?|₽)/iu.test(value)) return null;
  const amountMinorUnits = parseRubAmount(value);
  return amountMinorUnits === null
    ? null
    : { kind: "MONEY", amountMinorUnits, currency: "RUB", asOfDate: null };
}

function normalizeLayoutLabel(value: string) {
  return value.trim().replace(/[:№\-–—\s]+$/gu, "").toLocaleLowerCase("ru-RU");
}

function hasValidBox(line: LayoutFactLine): line is LayoutFactLine & {
  box: { left: number; top: number; width: number; height: number };
  confidence: number;
} {
  const box = line.box;
  return !!box && typeof line.confidence === "number" && Number.isFinite(line.confidence) &&
    line.confidence >= 0 && line.confidence <= 100 &&
    Number.isFinite(box.left) && Number.isFinite(box.top) &&
    Number.isFinite(box.width) && box.width > 0 &&
    Number.isFinite(box.height) && box.height > 0;
}

function linesGeometricallyRelated(label: LayoutFactLine, value: LayoutFactLine) {
  if (!hasValidBox(label) || !hasValidBox(value)) return false;
  const labelBottom = label.box.top + label.box.height;
  const valueBottom = value.box.top + value.box.height;
  const verticalOverlap = Math.max(0, Math.min(labelBottom, valueBottom) - Math.max(label.box.top, value.box.top));
  const overlapRatio = verticalOverlap / Math.min(label.box.height, value.box.height);
  const horizontalGap = value.box.left - (label.box.left + label.box.width);
  const sameRowToRight = overlapRatio >= 0.5 && horizontalGap >= -label.box.width * 0.1 &&
    horizontalGap <= Math.max(label.box.height * 12, label.box.width * 2);
  const gapBelow = value.box.top - labelBottom;
  const alignedBelow = gapBelow >= 0 && gapBelow <= Math.max(label.box.height, value.box.height) * 1.5 &&
    Math.abs(value.box.left - label.box.left) <= Math.max(40, label.box.width * 0.5);
  return sameRowToRight || alignedBelow;
}

function extractLayoutLabelValues(
  input: ExplicitFactExtractionInput,
  pageIndex: number,
  lines: readonly LayoutFactLine[],
  alreadyExtracted: ReadonlySet<string>,
): ExtractedFactCandidate[] {
  const candidates: ExtractedFactCandidate[] = [];
  const pairsByField = new Map<string, Array<{ label: LayoutFactLine; value: LayoutFactLine; valueIndex: number }>>();

  for (const rule of LAYOUT_LABEL_RULES) {
    if (alreadyExtracted.has(rule.fieldPath)) continue;
    const pairs: Array<{ label: LayoutFactLine; value: LayoutFactLine; valueIndex: number }> = [];
    for (const [labelIndex, label] of lines.entries()) {
      if (!hasValidBox(label)) continue;
      const normalized = normalizeLayoutLabel(label.text);
      if (!rule.labels.some((pattern) => pattern.test(normalized))) continue;
      const relatedValues = lines.flatMap((value, valueIndex) => {
        if (valueIndex === labelIndex || !hasValidBox(value) ||
            !linesGeometricallyRelated(label, value)) return [];
        const parsed = rule.parse(value.text.trim());
        if (!parsed) return [];
        return [{ value, valueIndex }];
      });
      // A second nearby parseable value can be a different field in a table.
      // Do not silently resolve that ambiguity by choosing whichever is closer.
      if (relatedValues.length === 1) {
        const only = relatedValues[0];
        pairs.push({ label, value: only.value, valueIndex: only.valueIndex });
      }
    }
    pairsByField.set(rule.fieldPath, pairs);
  }

  const fieldsByValueIndex = new Map<number, Set<string>>();
  for (const [fieldPath, pairs] of pairsByField) {
    for (const pair of pairs) {
      const fields = fieldsByValueIndex.get(pair.valueIndex) ?? new Set<string>();
      fields.add(fieldPath);
      fieldsByValueIndex.set(pair.valueIndex, fields);
    }
  }

  for (const rule of LAYOUT_LABEL_RULES) {
    if (alreadyExtracted.has(rule.fieldPath)) continue;
    const pairs = (pairsByField.get(rule.fieldPath) ?? []).filter(
      (pair) => fieldsByValueIndex.get(pair.valueIndex)?.size === 1,
    );
    // Repeated labels, shared values, or nearby values leave this field for
    // client review rather than assigning a value by rule order.
    if (pairs.length !== 1) continue;
    const pair = pairs[0];
    const value = rule.parse(pair.value.text.trim());
    if (!value || !hasValidBox(pair.label) || !hasValidBox(pair.value)) continue;
    const confidence = Math.min(0.70, pair.label.confidence / 100, pair.value.confidence / 100);
    candidates.push(parseExtractedFactCandidate({
      caseId: input.caseId,
      sourceFileId: input.sourceFileId,
      fieldPath: rule.fieldPath,
      recordKey: "default",
      sourcePage: pageIndex + 1,
      value,
      confidence,
      reviewStatus: "NEEDS_REVIEW",
    }));
  }
  return candidates;
}

/**
 * Extracts values only from explicit Russian labels or tightly constrained
 * label/value geometry. It never infers that a person, creditor, debt, or
 * asset is absent. Every result is unconfirmed and must be checked against its
 * cited OCR page before use in a draft.
 */
export function extractExplicitFactCandidates(
  input: ExplicitFactExtractionInput,
): ExtractedFactCandidate[] {
  const candidates: ExtractedFactCandidate[] = [];
  for (const [pageIndex, rawPageText] of input.pageTexts.entries()) {
    const structuredLines = input.pageLines?.[pageIndex];
    const pageText = structuredLines?.length
      ? structuredLines.map((line) => line.text).join("\n")
      : rawPageText;
    if (typeof pageText !== "string") continue;
    const pageCandidates = [
      ...extractCreditorRecords(input, pageIndex, pageText),
      ...extractAssetRecords(input, pageIndex, pageText),
    ];
    for (const rule of RULES) {
      const match = rule.pattern.exec(pageText);
      if (!match) continue;
      const value = rule.parse(match);
      if (!value) continue;
      pageCandidates.push(parseExtractedFactCandidate({
        caseId: input.caseId,
        sourceFileId: input.sourceFileId,
        fieldPath: rule.fieldPath,
        recordKey: "default",
        sourcePage: pageIndex + 1,
        value,
        confidence: rule.confidence,
        reviewStatus: "NEEDS_REVIEW",
      }));
    }
    const existingFieldPaths = new Set(pageCandidates.map((candidate) => candidate.fieldPath));
    if (structuredLines) {
      pageCandidates.push(...extractLayoutLabelValues(input, pageIndex, structuredLines, existingFieldPaths));
    }
    candidates.push(...pageCandidates);
  }
  return candidates;
}

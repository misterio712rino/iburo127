import type { ExtractedFactValue } from "./extracted-fact-contract";

export type ConfirmedFactForDraft = {
  id: string;
  fieldPath: string;
  recordKey: string;
  sourceFileId: string;
  sourceFileName: string;
  sourcePage: number;
  reviewStatus: "CONFIRMED" | "NEEDS_REVIEW" | "REJECTED";
  value: ExtractedFactValue;
};

export type ConfirmedFactDraft = {
  formatVersion: 1;
  documentCode: "bankruptcy-application" | "property-inventory" | "creditors-list";
  basis: "CONFIRMED_EXTRACTED_FACTS";
  facts: readonly {
    id: string;
    fieldPath: string;
    recordKey: string;
    displayLabel: string;
    displayValue: string;
    sourceFileId: string;
    sourceFileName: string;
    sourcePage: number;
  }[];
  missingDetails: readonly string[];
  previewText: string;
  courtReady: false;
};

const DOCUMENT_FIELDS: Readonly<Record<ConfirmedFactDraft["documentCode"], ReadonlySet<string>>> = {
  "bankruptcy-application": new Set([
    "subject.fullName", "subject.birthDate", "income.monthlyAmount", "creditors.amountTotal",
    "creditors.creditorName", "creditors.claimAmountUnclassified",
  ]),
  "property-inventory": new Set([
    "subject.fullName", "assets.description", "assets.address", "assets.ownership",
    "assets.pledgee", "assets.valueUnclassified",
  ]),
  "creditors-list": new Set([
    "subject.fullName", "creditors.creditorName", "creditors.claimAmountUnclassified", "creditors.amountTotal",
  ]),
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  "subject.fullName": "ФИО",
  "subject.birthDate": "Дата рождения",
  "income.monthlyAmount": "Ежемесячный доход",
  "creditors.amountTotal": "Общая сумма задолженности",
  "creditors.creditorName": "Кредитор",
  "creditors.claimAmountUnclassified": "Задолженность кредитора без разбивки",
  "assets.description": "Имущество",
  "assets.address": "Адрес имущества",
  "assets.ownership": "Вид собственности",
  "assets.pledgee": "Залогодержатель",
  "assets.valueUnclassified": "Стоимость имущества без классификации",
};

const DOCUMENT_TITLES: Readonly<Record<ConfirmedFactDraft["documentCode"], string>> = {
  "bankruptcy-application": "Заявление о банкротстве",
  "property-inventory": "Опись имущества",
  "creditors-list": "Список кредиторов",
};

const FIELD_ORDER = [
  "subject.fullName", "subject.birthDate", "income.monthlyAmount", "creditors.amountTotal",
  "creditors.creditorName", "creditors.claimAmountUnclassified", "assets.description",
  "assets.address", "assets.ownership", "assets.pledgee", "assets.valueUnclassified",
];
const FIELD_ORDER_INDEX = new Map(FIELD_ORDER.map((fieldPath, index) => [fieldPath, index]));

const MISSING_DETAILS: Readonly<Record<ConfirmedFactDraft["documentCode"], readonly string[]>> = {
  "bankruptcy-application": [
    "Необходимы дополнительные сведения о заявителе, суде, основаниях заявления и приложениях.",
    "Содержание и комплектность заявления должны быть проверены специалистом.",
  ],
  "property-inventory": [
    "Сведения об объектах и правах собственности необходимо сверить с правоустанавливающими документами.",
    "Полноту перечня имущества и оценку должен проверить специалист.",
  ],
  "creditors-list": [
    "По каждому кредитору необходимо проверить реквизиты и размер требования по первичным документам.",
    "Распознанная сумма задолженности не разделена на основной долг, проценты, неустойки и просрочку.",
  ],
};

function cleanDisplayText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
}

function formatMoney(value: Extract<ExtractedFactValue, { kind: "MONEY" }>) {
  const minor = BigInt(value.amountMinorUnits);
  const hundred = BigInt(100);
  const whole = (minor / hundred).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = (minor % hundred).toString().padStart(2, "0");
  return `${whole},${fraction} ${value.currency}`;
}

function displayValue(value: ExtractedFactValue) {
  if (value.kind === "TEXT") return cleanDisplayText(value.text);
  if (value.kind === "DATE") return value.isoDate;
  return formatMoney(value);
}

function compareFacts(left: ConfirmedFactForDraft, right: ConfirmedFactForDraft) {
  return left.recordKey.localeCompare(right.recordKey, "en") ||
    (FIELD_ORDER_INDEX.get(left.fieldPath) ?? Number.MAX_SAFE_INTEGER) -
      (FIELD_ORDER_INDEX.get(right.fieldPath) ?? Number.MAX_SAFE_INTEGER) ||
    left.sourcePage - right.sourcePage || left.id.localeCompare(right.id, "en");
}

/** Builds a review-only text summary. It is neither a legal form nor a rendered court document. */
export function buildConfirmedFactDraft(input: {
  documentCode: ConfirmedFactDraft["documentCode"];
  facts: readonly ConfirmedFactForDraft[];
}): ConfirmedFactDraft {
  const allowedFields = DOCUMENT_FIELDS[input.documentCode];
  if (!allowedFields) throw new Error("CONFIRMED_FACT_DRAFT_INVALID_DOCUMENT");
  const facts = input.facts
    .filter((fact) => fact.reviewStatus === "CONFIRMED" && allowedFields.has(fact.fieldPath))
    .slice()
    .sort(compareFacts)
    .map((fact) => {
      const displayLabel = FIELD_LABELS[fact.fieldPath];
      const display = displayValue(fact.value);
      if (!display || !displayLabel || !Number.isInteger(fact.sourcePage) || fact.sourcePage < 1 ||
          !fact.sourceFileId || !fact.sourceFileName || !fact.id || !fact.recordKey) {
        throw new Error("CONFIRMED_FACT_DRAFT_INVALID_FACT");
      }
      return {
        id: fact.id,
        fieldPath: fact.fieldPath,
        recordKey: fact.recordKey,
        displayLabel,
        displayValue: display,
        sourceFileId: fact.sourceFileId,
        sourceFileName: cleanDisplayText(fact.sourceFileName),
        sourcePage: fact.sourcePage,
      };
    });

  const missingDetails = MISSING_DETAILS[input.documentCode];
  const previewText = [
    `ПРЕДВАРИТЕЛЬНАЯ СВОДКА: ${DOCUMENT_TITLES[input.documentCode]}`,
    "Сформировано только из фактов, подтверждённых пользователем. Это не судебный документ и не предназначено для подачи.",
    ...(facts.length ? facts.map((fact) => `${fact.displayLabel}: ${fact.displayValue} [${fact.sourceFileName}, стр. ${fact.sourcePage}]`) : [
      "Для этой сводки пока нет подходящих подтверждённых фактов.",
    ]),
    ...missingDetails.map((detail) => `Требует проверки: ${detail}`),
    "Перед использованием необходимы сверка с оригиналами и подготовка документа специалистом.",
  ].join("\n");

  return {
    formatVersion: 1,
    documentCode: input.documentCode,
    basis: "CONFIRMED_EXTRACTED_FACTS",
    facts,
    missingDetails,
    previewText,
    courtReady: false,
  };
}

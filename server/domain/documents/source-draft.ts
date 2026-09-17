import { createHash } from "node:crypto";
import { getDocumentDefinition } from "@/lib/platform/document-definitions";
import { QUESTIONNAIRE_SECTIONS, isQuestionnaireFieldVisible } from "@/lib/platform/questionnaire-content";
import type { QuestionnaireAnswers, QuestionnaireField } from "@/lib/platform/types";

// A source draft is an internal data summary, NOT a court-ready document.
// It must not be exported, approved, or described as legally sufficient.
const SOURCE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "bankruptcy-application": ["fullName", "birthDate", "city", "maritalStatus", "incomeSource", "monthlyIncome", "creditorCount", "totalDebt", "hasOverdue", "hasEnforcement", "hasRealEstate", "hasVehicle"],
  "property-inventory": ["fullName", "hasRealEstate", "realEstateType", "ownershipShare", "realEstateValue", "onlyHousing", "hasMortgage", "mortgageBank", "mortgageBalance", "hasVehicle", "vehicleModel", "vehicleYear", "vehicleValue", "hasValuables", "valuablesNote"],
  "creditors-list": ["fullName", "creditorCount", "totalDebt", "hasOverdue", "hasEnforcement"],
  "income-obligations": ["fullName", "incomeSource", "monthlyIncome", "officialIncome", "additionalIncome", "creditorCount", "totalDebt", "hasOverdue"],
};

const UNCOLLECTED_DETAILS: Readonly<Record<string, readonly string[]>> = {
  "bankruptcy-application": ["Адрес заявителя, сведения о суде, обоснование требований и подтверждающие документы должны быть дополнены и проверены специалистом."],
  "property-inventory": ["Для полной описи нужны сведения о каждом конкретном объекте, правоустанавливающие документы и проверка специалистом."],
  "creditors-list": ["Анкета не содержит поимённого перечня кредиторов и должников, их реквизитов и отдельных сумм обязательств."],
  "income-obligations": ["Анкета не содержит документального подтверждения доходов и детализации обязательств по каждому кредитору."],
};

const fieldsById = new Map<string, QuestionnaireField>(
  QUESTIONNAIRE_SECTIONS.flatMap((section) => section.fields).map((field) => [field.id, field]),
);

function supplied(value: unknown): value is string | number | boolean {
  return typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim().length > 0);
}

function display(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  // Answer text is untrusted. Never allow CR/LF or other control characters to
  // forge another summary line or an apparent review statement.
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
}

export type DocumentSourceDraft = {
  formatVersion: 1;
  documentCode: string;
  questionnaireSchemaVersion: number;
  questionnaireVersion: number;
  answerSnapshot: QuestionnaireAnswers;
  missingFieldIds: readonly string[];
  uncollectedDetails: readonly string[];
  previewText: string;
  sha256: string;
  courtReady: false;
};

export function buildDocumentSourceDraft(input: {
  documentCode: string;
  questionnaireSchemaVersion: number;
  questionnaireVersion: number;
  answers: QuestionnaireAnswers;
}): DocumentSourceDraft {
  const definition = getDocumentDefinition(input.documentCode);
  const selectedFields = SOURCE_FIELDS[input.documentCode];
  const uncollectedDetails = UNCOLLECTED_DETAILS[input.documentCode];
  if (!definition || !selectedFields || !uncollectedDetails) {
    throw new Error("DOCUMENT_INVALID_CODE");
  }
  if (!Number.isSafeInteger(input.questionnaireSchemaVersion) || input.questionnaireSchemaVersion < 1 ||
      !Number.isSafeInteger(input.questionnaireVersion) || input.questionnaireVersion < 1) {
    throw new Error("DOCUMENT_INVALID_SOURCE_VERSION");
  }

  const snapshot: QuestionnaireAnswers = {};
  const missingFieldIds: string[] = [];
  const lines: string[] = [];
  const required = new Set<string>(definition.requiredFieldIds);
  for (const fieldId of selectedFields) {
    const field = fieldsById.get(fieldId);
    if (!field) throw new Error("DOCUMENT_UNKNOWN_SOURCE_FIELD");
    if (!isQuestionnaireFieldVisible(field, input.answers)) continue;
    const value = input.answers[fieldId];
    if (!supplied(value)) {
      if (field.required || required.has(fieldId)) missingFieldIds.push(fieldId);
      continue;
    }
    snapshot[fieldId] = value;
    lines.push(`${field.label}: ${display(value)}`);
  }
  // Deterministic key order ensures the digest does not depend on JSON insertion order.
  const answerSnapshot = Object.fromEntries(
    Object.entries(snapshot).sort(([left], [right]) => left.localeCompare(right, "en")),
  ) as QuestionnaireAnswers;
  const previewText = [
    `ПРЕДВАРИТЕЛЬНЫЕ СВЕДЕНИЯ: ${definition.title}`,
    "Внутренняя сводка данных анкеты. Не судебный документ и не предназначена для подачи.",
    ...lines,
    ...(missingFieldIds.length ? ["Не заполнены поля: " + missingFieldIds.map((id) => fieldsById.get(id)?.label ?? id).join(", ")] : []),
    ...uncollectedDetails.map((detail) => `Требует дополнения: ${detail}`),
    "Перед использованием необходима проверка и подготовка документа специалистом.",
  ].join("\n");
  const payload = {
    formatVersion: 1 as const,
    documentCode: input.documentCode,
    questionnaireSchemaVersion: input.questionnaireSchemaVersion,
    questionnaireVersion: input.questionnaireVersion,
    answerSnapshot,
    missingFieldIds,
    uncollectedDetails,
    previewText,
  };
  return {
    ...payload,
    sha256: createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex"),
    courtReady: false,
  };
}

// Integrity is a consistency check, not an authenticity signature. Callers
// must independently enforce case ownership and read the source from the DB.
export function verifyDocumentSourceDraftIntegrity(draft: DocumentSourceDraft): boolean {
  if (!draft || draft.formatVersion !== 1 || draft.courtReady !== false ||
      typeof draft.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(draft.sha256)) return false;
  try {
    const reconstructed = buildDocumentSourceDraft({
      documentCode: draft.documentCode,
      questionnaireSchemaVersion: draft.questionnaireSchemaVersion,
      questionnaireVersion: draft.questionnaireVersion,
      answers: draft.answerSnapshot,
    });
    return reconstructed.sha256 === draft.sha256 &&
      reconstructed.previewText === draft.previewText &&
      JSON.stringify(reconstructed.answerSnapshot) === JSON.stringify(draft.answerSnapshot) &&
      JSON.stringify(reconstructed.missingFieldIds) === JSON.stringify(draft.missingFieldIds) &&
      JSON.stringify(reconstructed.uncollectedDetails) === JSON.stringify(draft.uncollectedDetails);
  } catch {
    return false;
  }
}

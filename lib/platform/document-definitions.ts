import type { DocumentDefinition } from "./types";

export const DOCUMENT_DEFINITIONS = [
  {
    id: "bankruptcy-application",
    title: "Заявление о признании гражданина банкротом",
    description: "Черновик основных сведений для подготовки заявления.",
    requiredFieldIds: ["fullName", "city", "totalDebt", "creditorCount", "monthlyIncome", "hasRealEstate"],
  },
  {
    id: "property-inventory",
    title: "Опись имущества",
    description: "Сводные сведения о недвижимости, транспорте и другом имуществе.",
    requiredFieldIds: ["fullName", "hasRealEstate", "hasVehicle", "hasValuables"],
  },
  {
    id: "creditors-list",
    title: "Список кредиторов и должников",
    description: "Агрегированный предварительный список обязательств клиента.",
    requiredFieldIds: ["fullName", "creditorCount", "totalDebt", "hasOverdue"],
  },
  {
    id: "income-obligations",
    title: "Сведения о доходах и обязательствах",
    description: "Источники дохода и ключевые показатели финансовой нагрузки.",
    requiredFieldIds: ["fullName", "incomeSource", "monthlyIncome", "totalDebt"],
  },
] as const satisfies readonly DocumentDefinition[];

export function getDocumentDefinition(id: string) {
  return DOCUMENT_DEFINITIONS.find((document) => document.id === id);
}

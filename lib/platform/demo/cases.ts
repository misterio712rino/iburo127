import type { DemoClientCase } from "../types";

export const DEMO_CASES = [
  { caseNumber: "IBR-2026-000101", clientId: "alexander-lite", plan: "LITE", stage: "Обучение", status: "Активно", progress: 24, nextStep: "Продолжить практикум", assignedEmployeeId: "anna-lawyer", assignedLawyer: "Анна Орлова", openedDate: "15 января 2026" },
  { caseNumber: "IBR-2026-000102", clientId: "maria-pro", plan: "PRO", stage: "Анкета", status: "Активно", progress: 46, nextStep: "Заполнить сведения о доходах", assignedEmployeeId: "anna-lawyer", assignedLawyer: "Анна Орлова", openedDate: "3 февраля 2026" },
  { caseNumber: "IBR-2026-000103", clientId: "dmitry-individual", plan: "INDIVIDUAL", stage: "Подготовка документов", status: "Активно", progress: 63, nextStep: "Проверить подготовленные документы", assignedEmployeeId: "anna-lawyer", assignedLawyer: "Анна Орлова", openedDate: "20 февраля 2026" },
  { caseNumber: "IBR-2026-000104", clientId: "elena-lite", plan: "LITE", stage: "Обучение", status: "Активно", progress: 18, nextStep: "Продолжить Практикум", assignedEmployeeId: "anna-lawyer", assignedLawyer: "Анна Орлова", openedDate: "5 марта 2026" },
  { caseNumber: "IBR-2026-000105", clientId: "andrey-lite", plan: "LITE", stage: "Анкета", status: "Активно", progress: 31, nextStep: "Заполнить сведения о доходах", assignedEmployeeId: "sergey-lawyer", assignedLawyer: "Сергей Власов", openedDate: "12 марта 2026" },
  { caseNumber: "IBR-2026-000106", clientId: "olga-lite", plan: "LITE", stage: "Подготовка документов", status: "Активно", progress: 39, nextStep: "Дополнить сведения анкеты", assignedEmployeeId: "sergey-lawyer", assignedLawyer: "Сергей Власов", openedDate: "19 марта 2026" },
  { caseNumber: "IBR-2026-000107", clientId: "alexey-pro", plan: "PRO", stage: "Подготовка документов", status: "Активно", progress: 52, nextStep: "Проверить комплект документов", assignedEmployeeId: "sergey-lawyer", assignedLawyer: "Сергей Власов", openedDate: "2 апреля 2026" },
  { caseNumber: "IBR-2026-000108", clientId: "natalia-pro", plan: "PRO", stage: "Проверка юристом", status: "Активно", progress: 68, nextStep: "Завершить юридическую проверку", assignedEmployeeId: "sergey-lawyer", assignedLawyer: "Сергей Власов", openedDate: "10 апреля 2026" },
] as const satisfies readonly DemoClientCase[];

export function getCaseForIdentity(identityId: string): DemoClientCase | undefined {
  return DEMO_CASES.find((clientCase) => clientCase.clientId === identityId);
}

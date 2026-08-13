import type { DemoClientCase } from "../types";

export const DEMO_CASES = [
  { caseNumber: "IBR-2026-000101", clientId: "alexander-lite", plan: "LITE", stage: "Обучение", status: "Активно", progress: 24, nextStep: "Продолжить практикум", assignedLawyer: "Анна Орлова", openedDate: "15 января 2026" },
  { caseNumber: "IBR-2026-000102", clientId: "maria-pro", plan: "PRO", stage: "Анкета", status: "Активно", progress: 46, nextStep: "Заполнить сведения о доходах", assignedLawyer: "Анна Орлова", openedDate: "3 февраля 2026" },
  { caseNumber: "IBR-2026-000103", clientId: "dmitry-individual", plan: "INDIVIDUAL", stage: "Подготовка документов", status: "Активно", progress: 63, nextStep: "Проверить подготовленные документы", assignedLawyer: "Анна Орлова", openedDate: "20 февраля 2026" },
] as const satisfies readonly DemoClientCase[];

export function getCaseForIdentity(identityId: string): DemoClientCase | undefined {
  return DEMO_CASES.find((clientCase) => clientCase.clientId === identityId);
}

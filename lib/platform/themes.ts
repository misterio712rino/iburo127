import type { PlanCode, ThemeCode } from "./types";

export const PLAN_THEME: Record<PlanCode, ThemeCode> = {
  LITE: "light",
  PRO: "pro",
  INDIVIDUAL: "premium",
};

export const PLAN_LABEL: Record<PlanCode, string> = {
  LITE: "Лайт",
  PRO: "Про",
  INDIVIDUAL: "Эксклюзив",
};

export const ROLE_LABEL = {
  CLIENT: "Клиент",
  LAWYER: "Юрист",
  MANAGER: "Руководитель",
} as const;

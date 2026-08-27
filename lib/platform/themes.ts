import type { DemoIdentity, PlatformTheme, PlanCode } from "./types";

export const PLAN_THEME: Record<PlanCode, PlatformTheme> = {
  LITE: "light",
  PRO: "pro",
  INDIVIDUAL: "premium",
};

export const PLAN_LABEL: Record<PlanCode, string> = {
  LITE: "ЛАЙТ",
  PRO: "ПРО",
  INDIVIDUAL: "ИНДИВИДУАЛЬНЫЙ",
};

export function getPlatformTheme(identity: DemoIdentity): PlatformTheme {
  return identity.role === "LAWYER" || identity.role === "MANAGER" ? "staff" : PLAN_THEME[identity.plan ?? "LITE"];
}

import type { PlanCode } from "@/lib/platform/types";

export type ClientPlanTheme = {
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentSofter: string;
  accentRgb: string;
  glow: string;
  heroStart: string;
  heroMid: string;
  heroEnd: string;
};

export const CLIENT_PLAN_THEMES = {
  LITE: {
    accent: "#2f7d4a",
    accentHover: "#286b40",
    accentSoft: "#e8f4ec",
    accentSofter: "#f4faf6",
    accentRgb: "47, 125, 74",
    glow: "rgba(47, 125, 74, 0.08)",
    heroStart: "#378552",
    heroMid: "#2f7d4a",
    heroEnd: "#245f39",
  },
  PRO: {
    accent: "#4f46e5",
    accentHover: "#4338ca",
    accentSoft: "#ecebff",
    accentSofter: "#f6f6ff",
    accentRgb: "79, 70, 229",
    glow: "rgba(79, 70, 229, 0.08)",
    heroStart: "#6366f1",
    heroMid: "#4f46e5",
    heroEnd: "#3730a3",
  },
  INDIVIDUAL: {
    accent: "#8f1d2c",
    accentHover: "#761724",
    accentSoft: "#f6e9ec",
    accentSofter: "#fbf4f6",
    accentRgb: "143, 29, 44",
    glow: "rgba(143, 29, 44, 0.08)",
    heroStart: "#a82d42",
    heroMid: "#8f1d2c",
    heroEnd: "#67121f",
  },
} as const satisfies Record<PlanCode, ClientPlanTheme>;

export function getClientPlanTheme(planCode: PlanCode | null | undefined): ClientPlanTheme {
  return planCode ? CLIENT_PLAN_THEMES[planCode] : CLIENT_PLAN_THEMES.INDIVIDUAL;
}

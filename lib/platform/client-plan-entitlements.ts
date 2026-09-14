export function clientPlanHasHumanSupport(planCode: string): boolean {
  return planCode === "PRO" || planCode === "INDIVIDUAL";
}

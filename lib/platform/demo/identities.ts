import type { DemoIdentity } from "../types";

export const DEMO_IDENTITIES: readonly DemoIdentity[] = [
  { id: "alexander-lite", displayName: "Александр Лебедев", initials: "АЛ", role: "CLIENT", plan: "LITE", caseNumber: "IBR-2026-000101" },
  { id: "maria-pro", displayName: "Мария Соколова", initials: "МС", role: "CLIENT", plan: "PRO", caseNumber: "IBR-2026-000102" },
  { id: "dmitry-individual", displayName: "Дмитрий Волков", initials: "ДВ", role: "CLIENT", plan: "INDIVIDUAL", caseNumber: "IBR-2026-000103" },
  { id: "anna-lawyer", displayName: "Анна Орлова", initials: "АО", role: "LAWYER" },
] as const;

export const DEFAULT_CLIENT_IDENTITY = DEMO_IDENTITIES[0]!;
export const LAWYER_IDENTITY = DEMO_IDENTITIES[3]!;

export function getDemoIdentity(id: string | null): DemoIdentity | undefined {
  return DEMO_IDENTITIES.find((identity) => identity.id === id);
}

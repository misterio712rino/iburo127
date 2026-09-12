export const TECHNICAL_E2E_CLIENT = {
  label: "CLIENT_E2E",
  email: "client.staging-e2e@example.test",
  displayName: "Технический клиент E2E",
} as const;

export const LEGACY_E2E_CLIENT_EMAIL = "client.individual@example.test";

export const TECHNICAL_E2E_MUTATION_CASE_NUMBER = "IBR-2026-009901";
export const TECHNICAL_E2E_UNASSIGNED_CASE_NUMBER = "IBR-2026-000104";
export const TECHNICAL_E2E_CASE_NUMBERS = [
  TECHNICAL_E2E_MUTATION_CASE_NUMBER,
  TECHNICAL_E2E_UNASSIGNED_CASE_NUMBER,
] as const;

export type TechnicalE2eCaseNumber = (typeof TECHNICAL_E2E_CASE_NUMBERS)[number];

export function isTechnicalE2eFixture(input: { label: string; email: string }) {
  return input.label === TECHNICAL_E2E_CLIENT.label && input.email === TECHNICAL_E2E_CLIENT.email;
}

export function classifyTechnicalE2eDomainUser(input: {
  rowCount: number;
  status?: string;
  roleCodes?: readonly string[];
}) {
  if (input.rowCount === 0) return "create" as const;
  if (
    input.rowCount === 1 &&
    input.status === "ACTIVE" &&
    input.roleCodes?.length === 1 &&
    input.roleCodes[0] === "CLIENT"
  ) {
    return "ready" as const;
  }
  return "blocked" as const;
}

export function classifyTechnicalE2eCaseOwnership(input: {
  caseNumber: string;
  ownerId: string | null;
  technicalClientId: string;
  legacyClientId: string | null;
}) {
  if (!TECHNICAL_E2E_CASE_NUMBERS.includes(input.caseNumber as TechnicalE2eCaseNumber)) {
    return "blocked" as const;
  }
  if (input.ownerId === input.technicalClientId) return "ready" as const;
  if (input.ownerId === input.legacyClientId && input.legacyClientId !== null) return "migrate" as const;
  return "blocked" as const;
}

const ARBITRATION_CASE_NUMBER = /^[АA]\d{1,3}-\d+\/\d{4}$/u;

export function normalizeCourtCaseNumber(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || !ARBITRATION_CASE_NUMBER.test(normalized)) return null;
  return normalized.replace(/^A/u, "А");
}

export function getClientCaseDisplayNumber(value: string | null | undefined): string {
  const courtCaseNumber = normalizeCourtCaseNumber(value);
  return courtCaseNumber ? `Дело № ${courtCaseNumber}` : "Номер дела ещё не присвоен";
}

const INTERNAL_CASE_REFERENCE_PATTERN = /\bIBR?-[A-Z0-9][A-Z0-9_-]*\b/gi;
const UNASSIGNED_CASE_NUMBER = "Номер дела ещё не присвоен";

export function sanitizeCaseNotificationText(value: string) {
  return value.replace(INTERNAL_CASE_REFERENCE_PATTERN, UNASSIGNED_CASE_NUMBER);
}

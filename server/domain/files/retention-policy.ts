export const DEFAULT_FILE_RETENTION_YEARS = 5;
export const FILE_RETENTION_POLICY_VERSION = "2026-10-13";

export type RetentionChoice = "DELETE_NOW" | "KEEP_UNTIL_AUTOMATIC_DELETION";

export type FileRetentionSchedule =
  | { kind: "DELETE_NOW"; deleteAt: Date; policyVersion: string }
  | { kind: "SCHEDULED"; deleteAt: Date; policyVersion: string };

export function addCalendarYearsUtc(date: Date, years: number): Date {
  if (!Number.isFinite(date.getTime())) throw new Error("RETENTION_INVALID_DATE");
  if (!Number.isSafeInteger(years) || years < 1) throw new Error("RETENTION_INVALID_YEARS");

  const targetYear = date.getUTCFullYear() + years;
  if (!Number.isSafeInteger(targetYear)) throw new Error("RETENTION_INVALID_YEARS");
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(
    targetYear,
    month,
    Math.min(day, lastDayOfTargetMonth),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
}

export function createFileRetentionSchedule(input: {
  choice: RetentionChoice;
  procedureCompletedAt: Date;
  decidedAt: Date;
  retentionYears?: number;
  policyVersion?: string;
}): FileRetentionSchedule {
  if (!Number.isFinite(input.decidedAt.getTime())) throw new Error("RETENTION_INVALID_DATE");
  if (!Number.isFinite(input.procedureCompletedAt.getTime())) {
    throw new Error("RETENTION_INVALID_DATE");
  }

  const policyVersion = input.policyVersion ?? FILE_RETENTION_POLICY_VERSION;
  if (!policyVersion.trim()) throw new Error("RETENTION_INVALID_POLICY_VERSION");

  if (input.choice === "DELETE_NOW") {
    return { kind: "DELETE_NOW", deleteAt: new Date(input.decidedAt), policyVersion };
  }

  if (input.choice !== "KEEP_UNTIL_AUTOMATIC_DELETION") {
    throw new Error("RETENTION_INVALID_CHOICE");
  }

  return {
    kind: "SCHEDULED",
    deleteAt: addCalendarYearsUtc(
      input.procedureCompletedAt,
      input.retentionYears ?? DEFAULT_FILE_RETENTION_YEARS,
    ),
    policyVersion,
  };
}

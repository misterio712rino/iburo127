export type FileScanBacklogDiagnostic =
  | "DB_AUTH"
  | "DB_UNAVAILABLE"
  | "DB_TIMEOUT"
  | "DB_SCHEMA"
  | "DB_TRANSACTION"
  | "DB_ERROR";

const SAFE_DATABASE_CODES: Readonly<Record<string, FileScanBacklogDiagnostic>> = {
  P1000: "DB_AUTH",
  P1001: "DB_UNAVAILABLE",
  P1002: "DB_TIMEOUT",
  P1003: "DB_SCHEMA",
  P1008: "DB_TIMEOUT",
  P1017: "DB_UNAVAILABLE",
  P2021: "DB_SCHEMA",
  P2022: "DB_SCHEMA",
  P2024: "DB_TIMEOUT",
  P2034: "DB_TRANSACTION",
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function classifyFileScanBacklogError(error: unknown): FileScanBacklogDiagnostic {
  const outer = record(error);
  const cause = record(outer?.cause);
  const code = [outer?.code, outer?.errorCode, cause?.code, cause?.errorCode].find(
    (value): value is string => typeof value === "string" && Object.hasOwn(SAFE_DATABASE_CODES, value),
  );
  return code ? SAFE_DATABASE_CODES[code]! : "DB_ERROR";
}

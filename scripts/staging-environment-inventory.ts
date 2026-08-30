import "dotenv/config";

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { isValidYandexStorageBucketName } from "@/server/files/yandex-storage-bucket-name";
import { requireStagingAuthzFixtures } from "./staging-authz-fixture-guard";

export type StagingEnvironment = Readonly<Record<string, string | undefined>>;

const STAGING_AUTH_FLOW_REQUIREMENTS = [
  "IB_RUNTIME_TARGET",
  "IB_STAGING_BASE_URL",
  "IB_STAGING_AUTH_FLOW_TARGET",
  "IB_STAGING_AUTH_FLOW_CONFIRM",
  "IB_STAGING_CLIENT_EMAIL",
  "IB_STAGING_CLIENT_PASSWORD",
  "IB_STAGING_LAWYER_EMAIL",
  "IB_STAGING_LAWYER_PASSWORD",
  "IB_STAGING_LAWYER_TOTP_SECRET",
  "IB_STAGING_MANAGER_EMAIL",
  "IB_STAGING_MANAGER_PASSWORD",
  "IB_STAGING_MANAGER_TOTP_SECRET",
] as const;

const STAGING_AUTHZ_FIXTURE_REQUIREMENTS = [
  "IB_STAGING_CLIENT_USER_ID",
  "IB_STAGING_CLIENT_SUBJECT",
  "IB_STAGING_LAWYER_USER_ID",
  "IB_STAGING_LAWYER_SUBJECT",
  "IB_STAGING_MANAGER_USER_ID",
  "IB_STAGING_MANAGER_SUBJECT",
] as const;

const STAGING_SESSION_COOKIE_ENV_NAMES = [
  "IB_STAGING_CLIENT_COOKIE",
  "IB_STAGING_LAWYER_COOKIE",
  "IB_STAGING_MANAGER_COOKIE",
] as const;

export const STAGING_ENVIRONMENT_PHASES = {
  runtime: ["IB_RUNTIME_TARGET"],
  database: [
    "DATABASE_URL",
    "IB_DB_TARGET",
    "IB_STAGING_DATABASE_HOST",
    "IB_STAGING_DATABASE_NAME",
    "IB_STAGING_DATABASE_USER",
    "IB_STAGING_BETTER_AUTH_SCHEMA",
  ],
  authz: [
    "DATABASE_URL",
    "IB_DB_TARGET",
    "IB_STAGING_DATABASE_HOST",
    "IB_STAGING_DATABASE_NAME",
    "IB_STAGING_DATABASE_USER",
    ...STAGING_AUTHZ_FIXTURE_REQUIREMENTS,
  ],
  auth: ["IB_RUNTIME_TARGET", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "IB_STAGING_BASE_URL"],
  authFlow: [...STAGING_AUTH_FLOW_REQUIREMENTS],
  storage: [
    "IB_RUNTIME_TARGET",
    "IB_STAGING_BASE_URL",
    "IB_STORAGE_TARGET",
    "IB_STAGING_STORAGE_BUCKET",
    "IB_STAGING_STORAGE_ALLOWED_ORIGIN",
    "IB_STAGING_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_BUCKET",
    "YANDEX_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  ],
  scanner: [
    "IB_RUNTIME_TARGET",
    "IB_FILE_SCANNER_TARGET",
    "IB_FILE_SCANNER_ORIGIN",
    "IB_FILE_SCANNER_SECRET",
    "IB_STAGING_FILE_SCANNER_ORIGIN",
    "IB_STAGING_FILE_SCANNER_SECRET_SHA256",
    "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY",
    "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY",
    "IB_STAGING_FILE_SCANNER_CONFIRM",
    "IB_STORAGE_TARGET",
    "IB_STAGING_STORAGE_BUCKET",
    "IB_STAGING_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_BUCKET",
    "YANDEX_STORAGE_ACCESS_KEY_ID",
    "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  ],
  applicationE2e: [
    ...STAGING_AUTH_FLOW_REQUIREMENTS,
    "IB_STAGING_CLIENT_CASE_NUMBER",
    "IB_STAGING_LAWYER_CASE_NUMBER",
    "IB_STAGING_CLIENT_AI_CASE_NUMBER",
    "IB_STAGING_CLIENT_NO_AI_CASE_NUMBER",
    "IB_STAGING_MUTATION_TARGET",
    "IB_STAGING_MUTATION_CONFIRM",
    "IB_STAGING_MUTATION_CASE_NUMBER",
    "IB_STAGING_MUTATION_TASK_ID",
  ],
  postbox: [
    "IB_RUNTIME_TARGET",
    "IB_EMAIL_TARGET",
    "YANDEX_POSTBOX_FROM_EMAIL",
    "YANDEX_POSTBOX_ACCESS_KEY_ID",
    "YANDEX_POSTBOX_SECRET_ACCESS_KEY",
    "IB_STAGING_POSTBOX_FROM_EMAIL",
    "IB_STAGING_POSTBOX_ACCESS_KEY_ID",
    "IB_STAGING_POSTBOX_CONFIRM",
  ],
  openai: [
    "IB_RUNTIME_TARGET",
    "IB_AI_TARGET",
    "OPENAI_API_KEY",
    "IB_AI_OPENAI_MODEL",
    "IB_STAGING_OPENAI_MODEL",
    "IB_STAGING_OPENAI_KEY_SHA256",
    "IB_STAGING_AI_CONFIRM",
  ],
  bitrix24: [
    "IB_RUNTIME_TARGET",
    "IB_BITRIX24_TARGET",
    "BITRIX24_PORTAL_ORIGIN",
    "IB_BITRIX24_ALLOWED_HOST",
    "BITRIX24_WEBHOOK_USER_ID",
    "BITRIX24_WEBHOOK_SECRET",
    "BITRIX24_CASE_ENTITY_TYPE_ID",
    "BITRIX24_CASE_FIELD_MAP",
    "IB_STAGING_BITRIX24_PORTAL_ORIGIN",
    "IB_STAGING_BITRIX24_WEBHOOK_USER_ID",
    "IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256",
    "IB_STAGING_BITRIX24_CONFIRM",
  ],
  maintenance: [
    "IB_RUNTIME_TARGET",
    "BETTER_AUTH_URL",
    "IB_STAGING_BASE_URL",
    "IB_MAINTENANCE_SECRET",
    "IB_MAINTENANCE_BASE_URL",
  ],
} as const;

export type StagingEnvironmentPhase = keyof typeof STAGING_ENVIRONMENT_PHASES;

const PLACEHOLDER_PATTERNS = [
  /replace-with/i,
  /example\.com/i,
  /example\.net/i,
  /postgresql:\/\/USER:PASSWORD@HOST/i,
];

const STAGING_TARGET_VARIABLES: Partial<Record<StagingEnvironmentPhase, readonly string[]>> = {
  runtime: ["IB_RUNTIME_TARGET"],
  database: ["IB_DB_TARGET"],
  authz: ["IB_DB_TARGET"],
  auth: ["IB_RUNTIME_TARGET"],
  authFlow: ["IB_RUNTIME_TARGET", "IB_STAGING_AUTH_FLOW_TARGET"],
  storage: ["IB_RUNTIME_TARGET", "IB_STORAGE_TARGET"],
  scanner: ["IB_RUNTIME_TARGET", "IB_FILE_SCANNER_TARGET", "IB_STORAGE_TARGET"],
  applicationE2e: [
    "IB_RUNTIME_TARGET",
    "IB_STAGING_AUTH_FLOW_TARGET",
    "IB_STAGING_MUTATION_TARGET",
  ],
  postbox: ["IB_RUNTIME_TARGET", "IB_EMAIL_TARGET"],
  openai: ["IB_RUNTIME_TARGET", "IB_AI_TARGET"],
  bitrix24: ["IB_RUNTIME_TARGET", "IB_BITRIX24_TARGET"],
  maintenance: ["IB_RUNTIME_TARGET"],
};

const BITRIX24_CASE_PROJECTION_KEYS = ["caseNumber", "planCode", "stageCode", "status"] as const;
const BITRIX24_RESERVED_FIELD_NAMES = new Set(["__proto__", "prototype", "constructor"]);

function isConfigured(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function safeOrigin(value: string | undefined, allowLoopbackHttp: boolean): URL | null {
  if (!isConfigured(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value!.trim());
  } catch {
    return null;
  }
  const loopback =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";
  const protocolAllowed = parsed.protocol === "https:" || (allowLoopbackHttp && loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  return protocolAllowed && originOnly ? parsed : null;
}

function isProductionHostname(url: URL | null): boolean {
  if (!url) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
  return hostname === "iburo127.ru" || hostname.endsWith(".iburo127.ru");
}

function safeDatabaseUrl(value: string | undefined): URL | null {
  if (!isConfigured(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value!.trim());
  } catch {
    return null;
  }
  return parsed.protocol === "postgresql:" || parsed.protocol === "postgres:" ? parsed : null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function configuredFingerprint(value: string | undefined): string | null {
  if (!isConfigured(value)) return null;
  const normalized = value!.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function isSafeSecret(value: string | undefined, minLength: number): boolean {
  if (!isConfigured(value)) return false;
  const normalized = value!.trim();
  return normalized.length >= minLength && !/[\r\n\0]/.test(normalized);
}

function isExactSafeSecret(value: string | undefined, minLength: number): boolean {
  if (!value || !isConfigured(value)) return false;
  return value === value.trim() && value.length >= minLength && !/[\r\n\0]/.test(value);
}

function isValidAuthFixturePassword(value: string | undefined): boolean {
  if (!isConfigured(value)) return false;
  const normalized = value!.trim();
  return normalized.length >= 12 && normalized.length <= 128;
}

function isValidTotpSecret(value: string | undefined): boolean {
  if (!isConfigured(value)) return false;
  const normalized = value!.trim().toUpperCase().replace(/\s+/g, "").replace(/=+$/g, "");
  return normalized.length >= 2 && /^[A-Z2-7]+$/.test(normalized);
}

function isSafeScannerFixtureKey(value: string | undefined): boolean {
  if (!isConfigured(value)) return false;
  const normalized = value!.trim();
  return (
    normalized.length <= 512 &&
    normalized.startsWith("security-fixtures/file-scanner/") &&
    !normalized.startsWith("/") &&
    !normalized.includes("..") &&
    !normalized.includes("\\") &&
    !/[\r\n\0]/.test(normalized) &&
    /^[A-Za-z0-9._/-]+$/.test(normalized)
  );
}

function isValidBitrix24CaseEntityTypeId(value: string | undefined): boolean {
  if (!isConfigured(value)) return false;
  const raw = value!.trim();
  const entityTypeId = Number(raw);
  return (
    Number.isSafeInteger(entityTypeId) &&
    entityTypeId >= 1 &&
    entityTypeId <= 2_147_483_647 &&
    String(entityTypeId) === raw
  );
}

function isValidBitrix24CaseFieldMap(value: string | undefined): boolean {
  if (!isConfigured(value)) return false;
  const entries = value!.trim().split(",").map((entry) => entry.trim());
  if (entries.length !== BITRIX24_CASE_PROJECTION_KEYS.length || entries.some((entry) => !entry)) {
    return false;
  }

  const sourceKeys = new Set<string>();
  const targetNames = new Set<string>();
  const allowedSources = new Set<string>(BITRIX24_CASE_PROJECTION_KEYS);

  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0 || separator !== entry.lastIndexOf("=")) return false;
    const source = entry.slice(0, separator).trim();
    const target = entry.slice(separator + 1).trim();
    if (!allowedSources.has(source) || sourceKeys.has(source)) return false;
    if (
      !/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(target) ||
      BITRIX24_RESERVED_FIELD_NAMES.has(target.toLowerCase()) ||
      targetNames.has(target)
    ) {
      return false;
    }
    sourceKeys.add(source);
    targetNames.add(target);
  }

  return BITRIX24_CASE_PROJECTION_KEYS.every((key) => sourceKeys.has(key));
}

function invalidSemantics(
  phase: StagingEnvironmentPhase,
  env: StagingEnvironment,
): string[] {
  const invalid = new Set<string>();
  const mark = (...names: string[]) => names.forEach((name) => invalid.add(name));

  for (const name of STAGING_TARGET_VARIABLES[phase] ?? []) {
    if (isConfigured(env[name]) && env[name]?.trim() !== "staging") mark(name);
  }

  if (phase === "database" || phase === "authz") {
    const databaseUrl = safeDatabaseUrl(env.DATABASE_URL);
    if (isConfigured(env.DATABASE_URL) && !databaseUrl) {
      mark("DATABASE_URL");
    }
    if (databaseUrl) {
      const actualHost = databaseUrl.hostname.toLowerCase();
      const expectedHost = env.IB_STAGING_DATABASE_HOST?.trim().toLowerCase();
      if (isConfigured(env.IB_STAGING_DATABASE_HOST) && actualHost !== expectedHost) {
        mark("DATABASE_URL", "IB_STAGING_DATABASE_HOST");
      }

      const actualDatabaseName = safeDecode(databaseUrl.pathname.replace(/^\//, ""));
      const expectedDatabaseName = env.IB_STAGING_DATABASE_NAME?.trim();
      if (actualDatabaseName === null) {
        mark("DATABASE_URL");
      } else if (isConfigured(env.IB_STAGING_DATABASE_NAME) && actualDatabaseName !== expectedDatabaseName) {
        mark("DATABASE_URL", "IB_STAGING_DATABASE_NAME");
      }

      const actualUser = safeDecode(databaseUrl.username);
      const expectedUser = env.IB_STAGING_DATABASE_USER?.trim();
      if (actualUser === null) {
        mark("DATABASE_URL");
      } else if (isConfigured(env.IB_STAGING_DATABASE_USER) && actualUser !== expectedUser) {
        mark("DATABASE_URL", "IB_STAGING_DATABASE_USER");
      }
    }

    if (
      isConfigured(env.IB_STAGING_BETTER_AUTH_SCHEMA) &&
      env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() !== "public"
    ) {
      mark("IB_STAGING_BETTER_AUTH_SCHEMA");
    }
  }

  if (phase === "authz" && STAGING_AUTHZ_FIXTURE_REQUIREMENTS.every((name) => isConfigured(env[name]))) {
    try {
      requireStagingAuthzFixtures(env);
    } catch {
      mark(...STAGING_AUTHZ_FIXTURE_REQUIREMENTS);
    }
  }

  const stagingBase = safeOrigin(env.IB_STAGING_BASE_URL, true);
  const authOrigin = safeOrigin(env.BETTER_AUTH_URL, true);
  const usesStagingBase =
    phase === "auth" ||
    phase === "authFlow" ||
    phase === "storage" ||
    phase === "applicationE2e" ||
    phase === "maintenance";

  if (usesStagingBase && isConfigured(env.IB_STAGING_BASE_URL) && (!stagingBase || isProductionHostname(stagingBase))) {
    mark("IB_STAGING_BASE_URL");
  }
  if ((phase === "auth" || phase === "maintenance") && isConfigured(env.BETTER_AUTH_URL) && !authOrigin) {
    mark("BETTER_AUTH_URL");
  }
  if ((phase === "auth" || phase === "maintenance") && stagingBase && authOrigin && stagingBase.origin !== authOrigin.origin) {
    mark("BETTER_AUTH_URL", "IB_STAGING_BASE_URL");
  }

  if (phase === "auth" && isConfigured(env.BETTER_AUTH_SECRET) && !isSafeSecret(env.BETTER_AUTH_SECRET, 32)) {
    mark("BETTER_AUTH_SECRET");
  }

  if (phase === "authFlow" || phase === "applicationE2e") {
    for (const emailName of [
      "IB_STAGING_CLIENT_EMAIL",
      "IB_STAGING_LAWYER_EMAIL",
      "IB_STAGING_MANAGER_EMAIL",
    ]) {
      if (isConfigured(env[emailName]) && !env[emailName]!.trim().includes("@")) {
        mark(emailName);
      }
    }

    for (const passwordName of [
      "IB_STAGING_CLIENT_PASSWORD",
      "IB_STAGING_LAWYER_PASSWORD",
      "IB_STAGING_MANAGER_PASSWORD",
    ]) {
      if (isConfigured(env[passwordName]) && !isValidAuthFixturePassword(env[passwordName])) {
        mark(passwordName);
      }
    }

    for (const totpName of [
      "IB_STAGING_LAWYER_TOTP_SECRET",
      "IB_STAGING_MANAGER_TOTP_SECRET",
    ]) {
      if (isConfigured(env[totpName]) && !isValidTotpSecret(env[totpName])) {
        mark(totpName);
      }
    }

    if (isConfigured(env.IB_STAGING_AUTH_REQUEST_TIMEOUT_MS)) {
      const timeoutMs = Number(env.IB_STAGING_AUTH_REQUEST_TIMEOUT_MS!.trim());
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
        mark("IB_STAGING_AUTH_REQUEST_TIMEOUT_MS");
      }
    }
  }

  if ((phase === "authFlow" || phase === "applicationE2e") && stagingBase) {
    const expected = `AUTH-FLOW:${stagingBase.host}`;
    if (isConfigured(env.IB_STAGING_AUTH_FLOW_CONFIRM) && env.IB_STAGING_AUTH_FLOW_CONFIRM?.trim() !== expected) {
      mark("IB_STAGING_AUTH_FLOW_CONFIRM");
    }
  }

  if (phase === "applicationE2e") {
    for (const cookieName of STAGING_SESSION_COOKIE_ENV_NAMES) {
      if (Boolean(env[cookieName]?.trim())) {
        mark(cookieName);
      }
    }

    const clientCaseNumber = env.IB_STAGING_CLIENT_CASE_NUMBER?.trim();
    const lawyerCaseNumber = env.IB_STAGING_LAWYER_CASE_NUMBER?.trim();
    const aiCaseNumber = env.IB_STAGING_CLIENT_AI_CASE_NUMBER?.trim();
    const noAiCaseNumber = env.IB_STAGING_CLIENT_NO_AI_CASE_NUMBER?.trim();

    if (clientCaseNumber && lawyerCaseNumber && clientCaseNumber === lawyerCaseNumber) {
      mark("IB_STAGING_CLIENT_CASE_NUMBER", "IB_STAGING_LAWYER_CASE_NUMBER");
    }
    if (aiCaseNumber && noAiCaseNumber && aiCaseNumber === noAiCaseNumber) {
      mark("IB_STAGING_CLIENT_AI_CASE_NUMBER", "IB_STAGING_CLIENT_NO_AI_CASE_NUMBER");
    }
    if (lawyerCaseNumber && aiCaseNumber && lawyerCaseNumber === aiCaseNumber) {
      mark("IB_STAGING_LAWYER_CASE_NUMBER", "IB_STAGING_CLIENT_AI_CASE_NUMBER");
    }
    if (lawyerCaseNumber && noAiCaseNumber && lawyerCaseNumber === noAiCaseNumber) {
      mark("IB_STAGING_LAWYER_CASE_NUMBER", "IB_STAGING_CLIENT_NO_AI_CASE_NUMBER");
    }

    if (stagingBase) {
      const expected = `MUTATE:${stagingBase.host}`;
      if (isConfigured(env.IB_STAGING_MUTATION_CONFIRM) && env.IB_STAGING_MUTATION_CONFIRM?.trim() !== expected) {
        mark("IB_STAGING_MUTATION_CONFIRM");
      }
    }

    const filesE2eRaw = env.IB_STAGING_FILES_E2E?.trim() ?? "0";
    const fileScanE2eRaw = env.IB_STAGING_FILE_SCAN_E2E?.trim() ?? "0";
    const filesE2eValid = filesE2eRaw === "0" || filesE2eRaw === "1";
    const fileScanE2eValid = fileScanE2eRaw === "0" || fileScanE2eRaw === "1";

    if (!filesE2eValid) mark("IB_STAGING_FILES_E2E");
    if (!fileScanE2eValid) mark("IB_STAGING_FILE_SCAN_E2E");

    if (isConfigured(env.IB_STAGING_FILE_SCAN_E2E_MAX_RUNS)) {
      const maxRuns = Number(env.IB_STAGING_FILE_SCAN_E2E_MAX_RUNS!.trim());
      if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 20) {
        mark("IB_STAGING_FILE_SCAN_E2E_MAX_RUNS");
      }
    }

    const filesE2e = filesE2eValid && filesE2eRaw === "1";
    const fileScanE2e = fileScanE2eValid && fileScanE2eRaw === "1";

    if (fileScanE2e && !filesE2e) {
      mark("IB_STAGING_FILE_SCAN_E2E", "IB_STAGING_FILES_E2E");
    }

    if (filesE2e) {
      if (!isConfigured(env.IB_STAGING_OTHER_CLIENT_COOKIE)) {
        mark("IB_STAGING_OTHER_CLIENT_COOKIE");
      }
      if (stagingBase) {
        const expected = `PRIVATE_STAGING_BUCKET:${stagingBase.host}`;
        if (env.IB_STAGING_PRIVATE_BUCKET_CONFIRM?.trim() !== expected) {
          mark("IB_STAGING_PRIVATE_BUCKET_CONFIRM");
        }
      } else if (!isConfigured(env.IB_STAGING_PRIVATE_BUCKET_CONFIRM)) {
        mark("IB_STAGING_PRIVATE_BUCKET_CONFIRM");
      }
    }

    if (fileScanE2e) {
      if (stagingBase) {
        const expected = `SCAN:${stagingBase.host}`;
        if (env.IB_STAGING_FILE_SCAN_E2E_CONFIRM?.trim() !== expected) {
          mark("IB_STAGING_FILE_SCAN_E2E_CONFIRM");
        }
      } else if (!isConfigured(env.IB_STAGING_FILE_SCAN_E2E_CONFIRM)) {
        mark("IB_STAGING_FILE_SCAN_E2E_CONFIRM");
      }
      if (!isExactSafeSecret(env.IB_MAINTENANCE_SECRET, 32)) {
        mark("IB_MAINTENANCE_SECRET");
      }
    }
  }

  if (phase === "storage") {
    for (const bucketName of ["YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET"]) {
      if (isConfigured(env[bucketName]) && !isValidYandexStorageBucketName(env[bucketName]!.trim())) {
        mark(bucketName);
      }
    }
    if (isConfigured(env.YANDEX_STORAGE_BUCKET) && isConfigured(env.IB_STAGING_STORAGE_BUCKET) && env.YANDEX_STORAGE_BUCKET?.trim() !== env.IB_STAGING_STORAGE_BUCKET?.trim()) {
      mark("YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET");
    }
    if (isConfigured(env.YANDEX_STORAGE_ACCESS_KEY_ID) && isConfigured(env.IB_STAGING_STORAGE_ACCESS_KEY_ID) && env.YANDEX_STORAGE_ACCESS_KEY_ID?.trim() !== env.IB_STAGING_STORAGE_ACCESS_KEY_ID?.trim()) {
      mark("YANDEX_STORAGE_ACCESS_KEY_ID", "IB_STAGING_STORAGE_ACCESS_KEY_ID");
    }
    for (const credentialName of [
      "YANDEX_STORAGE_ACCESS_KEY_ID",
      "IB_STAGING_STORAGE_ACCESS_KEY_ID",
      "YANDEX_STORAGE_SECRET_ACCESS_KEY",
    ]) {
      if (isConfigured(env[credentialName]) && /[\r\n\0]/.test(env[credentialName]!.trim())) {
        mark(credentialName);
      }
    }
    const allowedOrigin = safeOrigin(env.IB_STAGING_STORAGE_ALLOWED_ORIGIN, true);
    if (isConfigured(env.IB_STAGING_STORAGE_ALLOWED_ORIGIN) && (!allowedOrigin || isProductionHostname(allowedOrigin))) {
      mark("IB_STAGING_STORAGE_ALLOWED_ORIGIN");
    }
    if (stagingBase && allowedOrigin && stagingBase.origin !== allowedOrigin.origin) {
      mark("IB_STAGING_BASE_URL", "IB_STAGING_STORAGE_ALLOWED_ORIGIN");
    }
  }

  if (phase === "scanner") {
    const scannerOrigin = safeOrigin(env.IB_FILE_SCANNER_ORIGIN, false);
    const expectedScannerOrigin = safeOrigin(env.IB_STAGING_FILE_SCANNER_ORIGIN, false);
    if (isConfigured(env.IB_FILE_SCANNER_ORIGIN) && !scannerOrigin) mark("IB_FILE_SCANNER_ORIGIN");
    if (isConfigured(env.IB_STAGING_FILE_SCANNER_ORIGIN) && !expectedScannerOrigin) mark("IB_STAGING_FILE_SCANNER_ORIGIN");
    if (scannerOrigin && expectedScannerOrigin && scannerOrigin.origin !== expectedScannerOrigin.origin) {
      mark("IB_FILE_SCANNER_ORIGIN", "IB_STAGING_FILE_SCANNER_ORIGIN");
    }
    for (const bucketName of ["YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET"]) {
      if (isConfigured(env[bucketName]) && !isValidYandexStorageBucketName(env[bucketName]!.trim())) {
        mark(bucketName);
      }
    }
    if (isConfigured(env.YANDEX_STORAGE_BUCKET) && isConfigured(env.IB_STAGING_STORAGE_BUCKET) && env.YANDEX_STORAGE_BUCKET?.trim() !== env.IB_STAGING_STORAGE_BUCKET?.trim()) {
      mark("YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET");
    }
    if (isConfigured(env.YANDEX_STORAGE_ACCESS_KEY_ID) && isConfigured(env.IB_STAGING_STORAGE_ACCESS_KEY_ID) && env.YANDEX_STORAGE_ACCESS_KEY_ID?.trim() !== env.IB_STAGING_STORAGE_ACCESS_KEY_ID?.trim()) {
      mark("YANDEX_STORAGE_ACCESS_KEY_ID", "IB_STAGING_STORAGE_ACCESS_KEY_ID");
    }
    for (const credentialName of [
      "YANDEX_STORAGE_ACCESS_KEY_ID",
      "YANDEX_STORAGE_SECRET_ACCESS_KEY",
    ]) {
      if (
        isConfigured(env[credentialName]) &&
        /[\r\n\0]/.test(env[credentialName]!.trim())
      ) {
        mark(credentialName);
      }
    }

    if (isConfigured(env.IB_FILE_SCANNER_SECRET) && !isSafeSecret(env.IB_FILE_SCANNER_SECRET, 32)) {
      mark("IB_FILE_SCANNER_SECRET");
    }
    const expectedFingerprint = configuredFingerprint(env.IB_STAGING_FILE_SCANNER_SECRET_SHA256);
    if (isConfigured(env.IB_STAGING_FILE_SCANNER_SECRET_SHA256) && !expectedFingerprint) {
      mark("IB_STAGING_FILE_SCANNER_SECRET_SHA256");
    }
    if (expectedFingerprint && isConfigured(env.IB_FILE_SCANNER_SECRET) && sha256Hex(env.IB_FILE_SCANNER_SECRET!.trim()) !== expectedFingerprint) {
      mark("IB_FILE_SCANNER_SECRET", "IB_STAGING_FILE_SCANNER_SECRET_SHA256");
    }

    const cleanKey = env.IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY?.trim();
    const maliciousKey = env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY?.trim();
    if (isConfigured(env.IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY) && !isSafeScannerFixtureKey(env.IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY)) {
      mark("IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY");
    }
    if (isConfigured(env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY) && !isSafeScannerFixtureKey(env.IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY)) {
      mark("IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY");
    }
    if (cleanKey && maliciousKey && cleanKey === maliciousKey) {
      mark("IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY", "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY");
    }

    if (expectedScannerOrigin && expectedFingerprint && isConfigured(env.IB_STAGING_STORAGE_BUCKET)) {
      const expectedConfirmation = `FILE-SCANNER-SMOKE:${expectedScannerOrigin.hostname}:${env.IB_STAGING_STORAGE_BUCKET!.trim()}:${expectedFingerprint}`;
      if (isConfigured(env.IB_STAGING_FILE_SCANNER_CONFIRM) && env.IB_STAGING_FILE_SCANNER_CONFIRM?.trim() !== expectedConfirmation) {
        mark("IB_STAGING_FILE_SCANNER_CONFIRM");
      }
    }
    if (isConfigured(env.IB_FILE_SCANNER_REQUEST_TIMEOUT_MS)) {
      const timeoutMs = Number(env.IB_FILE_SCANNER_REQUEST_TIMEOUT_MS!.trim());
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
        mark("IB_FILE_SCANNER_REQUEST_TIMEOUT_MS");
      }
    }
  }

  if (phase === "postbox") {
    for (const emailName of ["YANDEX_POSTBOX_FROM_EMAIL", "IB_STAGING_POSTBOX_FROM_EMAIL"]) {
      if (!isConfigured(env[emailName])) continue;
      const email = env[emailName]!.trim();
      if (
        email.length > 254 ||
        /[\r\n\0]/.test(email) ||
        !/^[^\s@]+@[^\s@]+$/.test(email)
      ) {
        mark(emailName);
      }
    }
    for (const credentialName of [
      "YANDEX_POSTBOX_ACCESS_KEY_ID",
      "YANDEX_POSTBOX_SECRET_ACCESS_KEY",
      "IB_STAGING_POSTBOX_ACCESS_KEY_ID",
    ]) {
      if (isConfigured(env[credentialName]) && /[\r\n\0]/.test(env[credentialName]!.trim())) {
        mark(credentialName);
      }
    }
    if (isConfigured(env.YANDEX_POSTBOX_FROM_EMAIL) && isConfigured(env.IB_STAGING_POSTBOX_FROM_EMAIL) && env.YANDEX_POSTBOX_FROM_EMAIL?.trim() !== env.IB_STAGING_POSTBOX_FROM_EMAIL?.trim()) {
      mark("YANDEX_POSTBOX_FROM_EMAIL", "IB_STAGING_POSTBOX_FROM_EMAIL");
    }
    if (isConfigured(env.YANDEX_POSTBOX_ACCESS_KEY_ID) && isConfigured(env.IB_STAGING_POSTBOX_ACCESS_KEY_ID) && env.YANDEX_POSTBOX_ACCESS_KEY_ID?.trim() !== env.IB_STAGING_POSTBOX_ACCESS_KEY_ID?.trim()) {
      mark("YANDEX_POSTBOX_ACCESS_KEY_ID", "IB_STAGING_POSTBOX_ACCESS_KEY_ID");
    }
    if (isConfigured(env.IB_STAGING_POSTBOX_FROM_EMAIL)) {
      const expected = `SIMULATOR:${env.IB_STAGING_POSTBOX_FROM_EMAIL?.trim()}`;
      if (isConfigured(env.IB_STAGING_POSTBOX_CONFIRM) && env.IB_STAGING_POSTBOX_CONFIRM?.trim() !== expected) mark("IB_STAGING_POSTBOX_CONFIRM");
    }
    if (isConfigured(env.YANDEX_POSTBOX_REQUEST_TIMEOUT_MS)) {
      const timeoutMs = Number(env.YANDEX_POSTBOX_REQUEST_TIMEOUT_MS!.trim());
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
        mark("YANDEX_POSTBOX_REQUEST_TIMEOUT_MS");
      }
    }
  }

  if (phase === "openai") {
    if (isConfigured(env.OPENAI_API_KEY)) {
      const apiKey = env.OPENAI_API_KEY!.trim();
      if (apiKey.length < 20 || /[\r\n\0]/.test(apiKey)) {
        mark("OPENAI_API_KEY");
      }
    }
    for (const modelName of ["IB_AI_OPENAI_MODEL", "IB_STAGING_OPENAI_MODEL"]) {
      if (!isConfigured(env[modelName])) continue;
      const model = env[modelName]!.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(model)) {
        mark(modelName);
      }
    }
    if (isConfigured(env.IB_AI_OPENAI_MODEL) && isConfigured(env.IB_STAGING_OPENAI_MODEL) && env.IB_AI_OPENAI_MODEL?.trim() !== env.IB_STAGING_OPENAI_MODEL?.trim()) {
      mark("IB_AI_OPENAI_MODEL", "IB_STAGING_OPENAI_MODEL");
    }
    const expectedFingerprint = configuredFingerprint(env.IB_STAGING_OPENAI_KEY_SHA256);
    if (isConfigured(env.IB_STAGING_OPENAI_KEY_SHA256) && !expectedFingerprint) {
      mark("IB_STAGING_OPENAI_KEY_SHA256");
    }
    if (expectedFingerprint && isConfigured(env.OPENAI_API_KEY) && sha256Hex(env.OPENAI_API_KEY!.trim()) !== expectedFingerprint) {
      mark("OPENAI_API_KEY", "IB_STAGING_OPENAI_KEY_SHA256");
    }
    if (expectedFingerprint && isConfigured(env.IB_AI_OPENAI_MODEL)) {
      const expectedConfirmation = `AI-SMOKE:${env.IB_AI_OPENAI_MODEL!.trim()}:${expectedFingerprint}`;
      if (isConfigured(env.IB_STAGING_AI_CONFIRM) && env.IB_STAGING_AI_CONFIRM?.trim() !== expectedConfirmation) {
        mark("IB_STAGING_AI_CONFIRM");
      }
    }
    if (isConfigured(env.IB_AI_OPENAI_REQUEST_TIMEOUT_MS)) {
      const timeoutMs = Number(env.IB_AI_OPENAI_REQUEST_TIMEOUT_MS!.trim());
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
        mark("IB_AI_OPENAI_REQUEST_TIMEOUT_MS");
      }
    }
  }

  if (phase === "bitrix24") {
    const portal = safeOrigin(env.BITRIX24_PORTAL_ORIGIN, false);
    const expectedPortal = safeOrigin(env.IB_STAGING_BITRIX24_PORTAL_ORIGIN, false);
    if (isConfigured(env.BITRIX24_PORTAL_ORIGIN) && !portal) mark("BITRIX24_PORTAL_ORIGIN");
    if (isConfigured(env.IB_STAGING_BITRIX24_PORTAL_ORIGIN) && !expectedPortal) mark("IB_STAGING_BITRIX24_PORTAL_ORIGIN");
    if (portal && expectedPortal && portal.origin !== expectedPortal.origin) mark("BITRIX24_PORTAL_ORIGIN", "IB_STAGING_BITRIX24_PORTAL_ORIGIN");
    if (expectedPortal && isConfigured(env.IB_BITRIX24_ALLOWED_HOST) && env.IB_BITRIX24_ALLOWED_HOST?.trim().toLowerCase() !== expectedPortal.hostname.toLowerCase()) mark("IB_BITRIX24_ALLOWED_HOST");

    const webhookUserId = env.BITRIX24_WEBHOOK_USER_ID?.trim();
    const expectedUserId = env.IB_STAGING_BITRIX24_WEBHOOK_USER_ID?.trim();
    if (isConfigured(env.BITRIX24_WEBHOOK_USER_ID) && !/^[1-9][0-9]{0,19}$/.test(webhookUserId ?? "")) {
      mark("BITRIX24_WEBHOOK_USER_ID");
    }
    if (isConfigured(env.BITRIX24_WEBHOOK_USER_ID) && isConfigured(env.IB_STAGING_BITRIX24_WEBHOOK_USER_ID) && webhookUserId !== expectedUserId) {
      mark("BITRIX24_WEBHOOK_USER_ID", "IB_STAGING_BITRIX24_WEBHOOK_USER_ID");
    }

    const webhookSecret = env.BITRIX24_WEBHOOK_SECRET?.trim();
    if (isConfigured(env.BITRIX24_WEBHOOK_SECRET) && !/^[A-Za-z0-9_-]{8,128}$/.test(webhookSecret ?? "")) {
      mark("BITRIX24_WEBHOOK_SECRET");
    }
    const expectedFingerprint = configuredFingerprint(env.IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256);
    if (isConfigured(env.IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256) && !expectedFingerprint) {
      mark("IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256");
    }
    if (expectedFingerprint && webhookSecret && sha256Hex(webhookSecret) !== expectedFingerprint) {
      mark("BITRIX24_WEBHOOK_SECRET", "IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256");
    }
    if (expectedPortal && expectedUserId && expectedFingerprint) {
      const expectedConfirmation = `BITRIX-VERIFY:${expectedPortal.hostname}:${expectedUserId}:${expectedFingerprint}`;
      if (isConfigured(env.IB_STAGING_BITRIX24_CONFIRM) && env.IB_STAGING_BITRIX24_CONFIRM?.trim() !== expectedConfirmation) {
        mark("IB_STAGING_BITRIX24_CONFIRM");
      }
    }

    if (isConfigured(env.BITRIX24_CASE_ENTITY_TYPE_ID) && !isValidBitrix24CaseEntityTypeId(env.BITRIX24_CASE_ENTITY_TYPE_ID)) {
      mark("BITRIX24_CASE_ENTITY_TYPE_ID");
    }
    if (isConfigured(env.BITRIX24_CASE_FIELD_MAP) && !isValidBitrix24CaseFieldMap(env.BITRIX24_CASE_FIELD_MAP)) {
      mark("BITRIX24_CASE_FIELD_MAP");
    }
    if (isConfigured(env.BITRIX24_REQUEST_TIMEOUT_MS)) {
      const timeoutMs = Number(env.BITRIX24_REQUEST_TIMEOUT_MS!.trim());
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
        mark("BITRIX24_REQUEST_TIMEOUT_MS");
      }
    }
  }

  if (phase === "maintenance") {
    const maintenanceOrigin = safeOrigin(env.IB_MAINTENANCE_BASE_URL, true);
    if (isConfigured(env.IB_MAINTENANCE_BASE_URL) && !maintenanceOrigin) mark("IB_MAINTENANCE_BASE_URL");
    if (stagingBase && maintenanceOrigin && stagingBase.origin !== maintenanceOrigin.origin) mark("IB_MAINTENANCE_BASE_URL", "IB_STAGING_BASE_URL");
    if (isConfigured(env.IB_MAINTENANCE_SECRET) && !isSafeSecret(env.IB_MAINTENANCE_SECRET, 32)) {
      mark("IB_MAINTENANCE_SECRET");
    }
    for (const timeoutName of [
      "IB_MAINTENANCE_REQUEST_TIMEOUT_MS",
      "IB_MAINTENANCE_FILE_SCAN_TIMEOUT_MS",
    ]) {
      if (!isConfigured(env[timeoutName])) continue;
      const timeoutMs = Number(env[timeoutName]!.trim());
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
        mark(timeoutName);
      }
    }
  }

  return [...invalid].sort();
}

export type StagingEnvironmentInventory = {
  networkAccessed: false;
  valuesPrinted: false;
  phases: Record<
    StagingEnvironmentPhase,
    {
      ready: boolean;
      requiredCount: number;
      configuredCount: number;
      missingOrPlaceholder: string[];
      invalidOrInconsistent: string[];
    }
  >;
};

export function buildStagingEnvironmentInventory(
  env: StagingEnvironment,
): StagingEnvironmentInventory {
  const phaseEntries = Object.entries(STAGING_ENVIRONMENT_PHASES).map(([phaseName, required]) => {
    const phase = phaseName as StagingEnvironmentPhase;
    const missingOrPlaceholder = required.filter((name) => !isConfigured(env[name]));
    const invalidOrInconsistent = invalidSemantics(phase, env);
    return [
      phase,
      {
        ready: missingOrPlaceholder.length === 0 && invalidOrInconsistent.length === 0,
        requiredCount: required.length,
        configuredCount: required.length - missingOrPlaceholder.length,
        missingOrPlaceholder,
        invalidOrInconsistent,
      },
    ] as const;
  });

  return {
    networkAccessed: false,
    valuesPrinted: false,
    phases: Object.fromEntries(phaseEntries) as StagingEnvironmentInventory["phases"],
  };
}

function parseRequestedPhase(argv: readonly string[]): StagingEnvironmentPhase | null {
  const raw = argv.find((value) => value.startsWith("--phase="))?.slice("--phase=".length);
  if (!raw) return null;
  if (!(raw in STAGING_ENVIRONMENT_PHASES)) {
    throw new Error(
      `unknown phase ${raw}; expected one of ${Object.keys(STAGING_ENVIRONMENT_PHASES).join(", ")}`,
    );
  }
  return raw as StagingEnvironmentPhase;
}

function printableInventory(
  inventory: StagingEnvironmentInventory,
  requestedPhase: StagingEnvironmentPhase | null,
) {
  return requestedPhase
    ? {
        networkAccessed: false,
        valuesPrinted: false,
        phases: { [requestedPhase]: inventory.phases[requestedPhase] },
      }
    : inventory;
}

async function main() {
  let requestedPhase: StagingEnvironmentPhase | null;
  try {
    requestedPhase = parseRequestedPhase(process.argv.slice(2));
  } catch (error) {
    console.error(
      `STAGING_ENV_INVENTORY_FAIL: ${error instanceof Error ? error.message : "invalid arguments"}`,
    );
    process.exitCode = 1;
    return;
  }

  const inventory = buildStagingEnvironmentInventory(process.env);
  const output = printableInventory(inventory, requestedPhase);
  console.log(JSON.stringify(output, null, 2));

  const phases = requestedPhase ? [inventory.phases[requestedPhase]] : Object.values(inventory.phases);
  const ready = phases.every((phase) => phase.ready);
  console.error(ready ? "STAGING_ENV_INVENTORY_READY" : "STAGING_ENV_INVENTORY_INCOMPLETE");
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  await main();
}

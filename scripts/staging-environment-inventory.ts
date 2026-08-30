import "dotenv/config";

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

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

function invalidSemantics(
  phase: StagingEnvironmentPhase,
  env: StagingEnvironment,
): string[] {
  const invalid = new Set<string>();
  const mark = (...names: string[]) => names.forEach((name) => invalid.add(name));

  for (const name of STAGING_TARGET_VARIABLES[phase] ?? []) {
    if (isConfigured(env[name]) && env[name]?.trim() !== "staging") mark(name);
  }

  if (phase === "database") {
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

  if ((phase === "authFlow" || phase === "applicationE2e") && stagingBase) {
    const expected = `AUTH-FLOW:${stagingBase.host}`;
    if (isConfigured(env.IB_STAGING_AUTH_FLOW_CONFIRM) && env.IB_STAGING_AUTH_FLOW_CONFIRM?.trim() !== expected) {
      mark("IB_STAGING_AUTH_FLOW_CONFIRM");
    }
  }

  if (phase === "applicationE2e" && stagingBase) {
    const expected = `MUTATE:${stagingBase.host}`;
    if (isConfigured(env.IB_STAGING_MUTATION_CONFIRM) && env.IB_STAGING_MUTATION_CONFIRM?.trim() !== expected) {
      mark("IB_STAGING_MUTATION_CONFIRM");
    }
  }

  if (phase === "storage") {
    if (isConfigured(env.YANDEX_STORAGE_BUCKET) && isConfigured(env.IB_STAGING_STORAGE_BUCKET) && env.YANDEX_STORAGE_BUCKET?.trim() !== env.IB_STAGING_STORAGE_BUCKET?.trim()) {
      mark("YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET");
    }
    if (isConfigured(env.YANDEX_STORAGE_ACCESS_KEY_ID) && isConfigured(env.IB_STAGING_STORAGE_ACCESS_KEY_ID) && env.YANDEX_STORAGE_ACCESS_KEY_ID?.trim() !== env.IB_STAGING_STORAGE_ACCESS_KEY_ID?.trim()) {
      mark("YANDEX_STORAGE_ACCESS_KEY_ID", "IB_STAGING_STORAGE_ACCESS_KEY_ID");
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
    if (isConfigured(env.YANDEX_STORAGE_BUCKET) && isConfigured(env.IB_STAGING_STORAGE_BUCKET) && env.YANDEX_STORAGE_BUCKET?.trim() !== env.IB_STAGING_STORAGE_BUCKET?.trim()) {
      mark("YANDEX_STORAGE_BUCKET", "IB_STAGING_STORAGE_BUCKET");
    }
    if (isConfigured(env.YANDEX_STORAGE_ACCESS_KEY_ID) && isConfigured(env.IB_STAGING_STORAGE_ACCESS_KEY_ID) && env.YANDEX_STORAGE_ACCESS_KEY_ID?.trim() !== env.IB_STAGING_STORAGE_ACCESS_KEY_ID?.trim()) {
      mark("YANDEX_STORAGE_ACCESS_KEY_ID", "IB_STAGING_STORAGE_ACCESS_KEY_ID");
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
  }

  if (phase === "postbox") {
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
  }

  if (phase === "openai") {
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
  }

  if (phase === "maintenance") {
    const maintenanceOrigin = safeOrigin(env.IB_MAINTENANCE_BASE_URL, true);
    if (isConfigured(env.IB_MAINTENANCE_BASE_URL) && !maintenanceOrigin) mark("IB_MAINTENANCE_BASE_URL");
    if (stagingBase && maintenanceOrigin && stagingBase.origin !== maintenanceOrigin.origin) mark("IB_MAINTENANCE_BASE_URL", "IB_STAGING_BASE_URL");
    if (isConfigured(env.IB_MAINTENANCE_SECRET) && !isSafeSecret(env.IB_MAINTENANCE_SECRET, 32)) {
      mark("IB_MAINTENANCE_SECRET");
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

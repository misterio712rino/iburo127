import "server-only";

export const PRODUCTION_CONFIG_ERROR = "PRODUCTION_CONFIG_ERROR";

function requireEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  return value;
}

function readIntegerEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  }
  return value;
}

function requireSafeEmailAddress(env: NodeJS.ProcessEnv, name: string) {
  const value = requireEnv(env, name);
  if (value.length > 254 || /[\r\n\0]/.test(value) || !/^[^\s@]+@[^\s@]+$/.test(value)) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  }
  return value;
}

function requireHttpsOrigin(env: NodeJS.ProcessEnv, name: string) {
  const value = requireEnv(env, name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  }

  const originOnly =
    parsed.protocol === "https:" &&
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  if (!originOnly) throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  return parsed.origin;
}

export type ProductionDatabaseConfig = {
  databaseUrl: string;
};

export type BetterAuthRuntimeConfig = {
  secret: string;
  baseUrl: string;
};

export type YandexObjectStorageConfig = {
  bucket: string;
  region: "ru-central1";
  endpoint: "https://storage.yandexcloud.net";
  accessKeyId: string;
  secretAccessKey: string;
};

export type YandexPostboxConfig = {
  fromEmail: string;
  region: "ru-central1";
  endpoint: "https://postbox.cloud.yandex.net";
  host: "postbox.cloud.yandex.net";
  accessKeyId: string;
  secretAccessKey: string;
  requestTimeoutMs: number;
};

export type OpenAiRuntimeConfig = {
  apiKey: string;
  model: string;
  endpoint: "https://api.openai.com/v1/responses";
  requestTimeoutMs: number;
  maxOutputTokens: number;
};

export type FileScannerRuntimeConfig = {
  origin: string;
  secret: string;
  requestTimeoutMs: number;
};

export type MaintenanceRuntimeConfig = {
  secret: string;
  staleUploadMaxAgeMinutes: number;
  staleUploadBatchLimit: number;
  staleUploadHealthGraceMinutes: number;
  staleUploadHealthBatchLimit: number;
  notificationDeliveryHealthGraceMinutes: number;
  notificationDeliveryHealthBatchLimit: number;
  fileScanBatchLimit: number;
  fileScanLeaseSeconds: number;
  fileScanSourceUrlTtlSeconds: number;
  fileScanMaxAttempts: number;
  fileScanRetryBaseSeconds: number;
  fileScanRetryMaxSeconds: number;
  fileScanHealthGraceMinutes: number;
  fileScanHealthBatchLimit: number;
  aiAuditGraceMinutes: number;
  aiAuditBatchLimit: number;
};

export function readProductionDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductionDatabaseConfig {
  return { databaseUrl: requireEnv(env, "DATABASE_URL") };
}

export function readBetterAuthRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): BetterAuthRuntimeConfig {
  const secret = requireEnv(env, "BETTER_AUTH_SECRET");
  if (secret.length < 32) throw new Error(`${PRODUCTION_CONFIG_ERROR}:BETTER_AUTH_SECRET`);

  const baseUrl = requireEnv(env, "BETTER_AUTH_URL");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:BETTER_AUTH_URL`);
  }

  const secureProtocol = parsed.protocol === "https:" || parsed.hostname === "localhost";
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;
  if (!secureProtocol || !originOnly) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:BETTER_AUTH_URL`);
  }

  return {
    secret,
    baseUrl: parsed.origin,
  };
}

export function readYandexObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): YandexObjectStorageConfig {
  return {
    bucket: requireEnv(env, "YANDEX_STORAGE_BUCKET"),
    region: "ru-central1",
    endpoint: "https://storage.yandexcloud.net",
    accessKeyId: requireEnv(env, "YANDEX_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(env, "YANDEX_STORAGE_SECRET_ACCESS_KEY"),
  };
}

export function readYandexPostboxConfig(
  env: NodeJS.ProcessEnv = process.env,
): YandexPostboxConfig {
  return {
    fromEmail: requireSafeEmailAddress(env, "YANDEX_POSTBOX_FROM_EMAIL"),
    region: "ru-central1",
    endpoint: "https://postbox.cloud.yandex.net",
    host: "postbox.cloud.yandex.net",
    accessKeyId: requireEnv(env, "YANDEX_POSTBOX_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(env, "YANDEX_POSTBOX_SECRET_ACCESS_KEY"),
    requestTimeoutMs: readIntegerEnv(
      env,
      "YANDEX_POSTBOX_REQUEST_TIMEOUT_MS",
      10_000,
      1_000,
      30_000,
    ),
  };
}

export function readOpenAiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): OpenAiRuntimeConfig {
  const apiKey = requireEnv(env, "OPENAI_API_KEY");
  if (apiKey.length < 20 || /[\r\n\0]/.test(apiKey)) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:OPENAI_API_KEY`);
  }

  const model = requireEnv(env, "IB_AI_OPENAI_MODEL");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(model)) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_AI_OPENAI_MODEL`);
  }

  return {
    apiKey,
    model,
    endpoint: "https://api.openai.com/v1/responses",
    requestTimeoutMs: readIntegerEnv(
      env,
      "IB_AI_OPENAI_REQUEST_TIMEOUT_MS",
      20_000,
      1_000,
      60_000,
    ),
    maxOutputTokens: readIntegerEnv(
      env,
      "IB_AI_OPENAI_MAX_OUTPUT_TOKENS",
      1_200,
      128,
      4_000,
    ),
  };
}

export function readFileScannerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): FileScannerRuntimeConfig {
  const secret = requireEnv(env, "IB_FILE_SCANNER_SECRET");
  if (secret.length < 32 || /[\r\n\0]/.test(secret)) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_FILE_SCANNER_SECRET`);
  }

  return {
    origin: requireHttpsOrigin(env, "IB_FILE_SCANNER_ORIGIN"),
    secret,
    requestTimeoutMs: readIntegerEnv(
      env,
      "IB_FILE_SCANNER_REQUEST_TIMEOUT_MS",
      60_000,
      1_000,
      120_000,
    ),
  };
}

export function readMaintenanceRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): MaintenanceRuntimeConfig {
  const secret = requireEnv(env, "IB_MAINTENANCE_SECRET");
  if (secret.length < 32) throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_MAINTENANCE_SECRET`);

  const fileScanLeaseSeconds = readIntegerEnv(
    env,
    "IB_FILE_SCAN_LEASE_SECONDS",
    120,
    30,
    900,
  );
  const fileScanSourceUrlTtlSeconds = readIntegerEnv(
    env,
    "IB_FILE_SCAN_SOURCE_URL_TTL_SECONDS",
    180,
    30,
    900,
  );
  if (fileScanSourceUrlTtlSeconds < fileScanLeaseSeconds) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_FILE_SCAN_SOURCE_URL_TTL_SECONDS`);
  }

  const fileScanRetryBaseSeconds = readIntegerEnv(
    env,
    "IB_FILE_SCAN_RETRY_BASE_SECONDS",
    60,
    10,
    3_600,
  );
  const fileScanRetryMaxSeconds = readIntegerEnv(
    env,
    "IB_FILE_SCAN_RETRY_MAX_SECONDS",
    3_600,
    10,
    86_400,
  );
  if (fileScanRetryMaxSeconds < fileScanRetryBaseSeconds) {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:IB_FILE_SCAN_RETRY_MAX_SECONDS`);
  }

  return {
    secret,
    staleUploadMaxAgeMinutes: readIntegerEnv(
      env,
      "IB_STALE_UPLOAD_MAX_AGE_MINUTES",
      60,
      15,
      10_080,
    ),
    staleUploadBatchLimit: readIntegerEnv(env, "IB_STALE_UPLOAD_BATCH_LIMIT", 100, 1, 500),
    staleUploadHealthGraceMinutes: readIntegerEnv(
      env,
      "IB_STALE_UPLOAD_HEALTH_GRACE_MINUTES",
      30,
      5,
      1_440,
    ),
    staleUploadHealthBatchLimit: readIntegerEnv(
      env,
      "IB_STALE_UPLOAD_HEALTH_BATCH_LIMIT",
      50,
      1,
      200,
    ),
    notificationDeliveryHealthGraceMinutes: readIntegerEnv(
      env,
      "IB_NOTIFICATION_DELIVERY_HEALTH_GRACE_MINUTES",
      15,
      2,
      1_440,
    ),
    notificationDeliveryHealthBatchLimit: readIntegerEnv(
      env,
      "IB_NOTIFICATION_DELIVERY_HEALTH_BATCH_LIMIT",
      50,
      1,
      200,
    ),
    fileScanBatchLimit: readIntegerEnv(env, "IB_FILE_SCAN_BATCH_LIMIT", 1, 1, 10),
    fileScanLeaseSeconds,
    fileScanSourceUrlTtlSeconds,
    fileScanMaxAttempts: readIntegerEnv(env, "IB_FILE_SCAN_MAX_ATTEMPTS", 5, 1, 20),
    fileScanRetryBaseSeconds,
    fileScanRetryMaxSeconds,
    fileScanHealthGraceMinutes: readIntegerEnv(
      env,
      "IB_FILE_SCAN_HEALTH_GRACE_MINUTES",
      15,
      2,
      1_440,
    ),
    fileScanHealthBatchLimit: readIntegerEnv(
      env,
      "IB_FILE_SCAN_HEALTH_BATCH_LIMIT",
      50,
      1,
      200,
    ),
    aiAuditGraceMinutes: readIntegerEnv(
      env,
      "IB_AI_AUDIT_GRACE_MINUTES",
      10,
      2,
      1_440,
    ),
    aiAuditBatchLimit: readIntegerEnv(env, "IB_AI_AUDIT_BATCH_LIMIT", 50, 1, 200),
  };
}

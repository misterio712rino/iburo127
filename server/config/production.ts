import "server-only";

export const PRODUCTION_CONFIG_ERROR = "PRODUCTION_CONFIG_ERROR";

function requireEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${PRODUCTION_CONFIG_ERROR}:${name}`);
  return value;
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

export function readProductionDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductionDatabaseConfig {
  return { databaseUrl: requireEnv(env, "DATABASE_URL") };
}

export function readBetterAuthRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): BetterAuthRuntimeConfig {
  const baseUrl = requireEnv(env, "BETTER_AUTH_URL");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:BETTER_AUTH_URL`);
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error(`${PRODUCTION_CONFIG_ERROR}:BETTER_AUTH_URL`);
  }

  return {
    secret: requireEnv(env, "BETTER_AUTH_SECRET"),
    baseUrl: parsed.toString().replace(/\/$/, ""),
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

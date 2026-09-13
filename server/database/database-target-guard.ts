export const DATABASE_TARGET_CONFIG_ERROR = "DATABASE_TARGET_CONFIG_ERROR";

type DatabaseTargetEnvironment = Pick<
  NodeJS.ProcessEnv,
  | "NODE_ENV"
  | "VERCEL_ENV"
  | "IB_RUNTIME_TARGET"
  | "IB_DB_TARGET"
  | "IB_PRODUCTION_DATABASE_HOST"
  | "IB_PRODUCTION_DATABASE_NAME"
  | "IB_PRODUCTION_DATABASE_USER"
>;

function fail(name: string): never {
  throw new Error(`${DATABASE_TARGET_CONFIG_ERROR}:${name}`);
}

function normalizeTarget(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function requireProductionMetadata(
  env: DatabaseTargetEnvironment,
  name:
    | "IB_PRODUCTION_DATABASE_HOST"
    | "IB_PRODUCTION_DATABASE_NAME"
    | "IB_PRODUCTION_DATABASE_USER",
) {
  const value = env[name]?.trim();
  if (!value || /[\r\n\0]/.test(value) || /replace-with|example\.(?:com|net|org)/i.test(value)) {
    fail(name);
  }
  return value;
}

function decodeUrlComponent(value: string, errorName: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    fail(errorName);
  }
}

export function assertDatabaseTargetBoundary(
  databaseUrl: string,
  env: DatabaseTargetEnvironment = process.env,
): void {
  const runtimeTarget = normalizeTarget(env.IB_RUNTIME_TARGET);
  const databaseTarget = normalizeTarget(env.IB_DB_TARGET);
  const vercelEnvironment = normalizeTarget(env.VERCEL_ENV);

  const productionRequested =
    runtimeTarget === "production" ||
    databaseTarget === "production" ||
    vercelEnvironment === "production";

  if (!productionRequested) return;

  if (runtimeTarget !== "production") fail("IB_RUNTIME_TARGET");
  if (databaseTarget !== "production") fail("IB_DB_TARGET");
  if (normalizeTarget(env.NODE_ENV) !== "production") fail("NODE_ENV");
  if (vercelEnvironment && vercelEnvironment !== "production") fail("VERCEL_ENV");

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL");
  }

  const expectedHost = requireProductionMetadata(env, "IB_PRODUCTION_DATABASE_HOST");
  const expectedDatabase = requireProductionMetadata(env, "IB_PRODUCTION_DATABASE_NAME");
  const expectedUser = requireProductionMetadata(env, "IB_PRODUCTION_DATABASE_USER");

  if (parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    fail("IB_PRODUCTION_DATABASE_HOST");
  }

  const databaseName = decodeUrlComponent(parsed.pathname.replace(/^\/+/, ""), "DATABASE_URL");
  if (!databaseName || databaseName !== expectedDatabase) {
    fail("IB_PRODUCTION_DATABASE_NAME");
  }

  const databaseUser = decodeUrlComponent(parsed.username, "DATABASE_URL");
  if (!databaseUser || databaseUser !== expectedUser) {
    fail("IB_PRODUCTION_DATABASE_USER");
  }

  if (parsed.searchParams.get("sslmode")?.toLowerCase() !== "verify-full") {
    fail("DATABASE_URL_SSLMODE");
  }
}

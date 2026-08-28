export type Environment = Readonly<Record<string, string | undefined>>;

export type StagingDatabaseTarget = {
  databaseUrl: string;
  expectedDatabaseName: string;
  expectedHost: string;
  expectedUser: string;
};

function requireValue(env: Environment, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

export function requireStagingDatabaseTarget(env: Environment = process.env): StagingDatabaseTarget {
  if (env.IB_DB_TARGET?.trim() !== "staging") {
    throw new Error('IB_DB_TARGET must be exactly "staging"');
  }

  const databaseUrl = requireValue(env, "DATABASE_URL");
  const expectedDatabaseName = requireValue(env, "IB_STAGING_DATABASE_NAME");
  const expectedHost = requireValue(env, "IB_STAGING_DATABASE_HOST").toLowerCase();
  const expectedUser = requireValue(env, "IB_STAGING_DATABASE_USER");

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use postgresql:// or postgres://");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const databaseUser = decodeURIComponent(parsed.username);
  const databaseHost = parsed.hostname.toLowerCase();

  if (!databaseName || databaseName !== expectedDatabaseName) {
    throw new Error("DATABASE_URL database does not match IB_STAGING_DATABASE_NAME");
  }
  if (!databaseHost || databaseHost !== expectedHost) {
    throw new Error("DATABASE_URL host does not match IB_STAGING_DATABASE_HOST");
  }
  if (!databaseUser || databaseUser !== expectedUser) {
    throw new Error("DATABASE_URL user does not match IB_STAGING_DATABASE_USER");
  }

  return { databaseUrl, expectedDatabaseName, expectedHost, expectedUser };
}

export function requireStagingMutationConfirmation(
  env: Environment,
  variableName: string,
  action: string,
  expectedDatabaseName: string,
) {
  const expected = `${action}:${expectedDatabaseName}`;
  if (env[variableName]?.trim() !== expected) {
    throw new Error(`${variableName} must be exactly ${expected}`);
  }
  return expected;
}

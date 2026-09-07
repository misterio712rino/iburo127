export const VERCEL_BLOB_CONFIG_ERROR = "VERCEL_BLOB_CONFIG_ERROR";

export type VercelBlobAuthMode = "read-write-token" | "oidc";

export type VercelBlobAuthConfig =
  | {
      mode: "read-write-token";
      token: string;
    }
  | {
      mode: "oidc";
      oidcToken: string;
      storeId: string;
    };

type Environment = Readonly<{
  IB_VERCEL_BLOB_AUTH_MODE?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  VERCEL_OIDC_TOKEN?: string;
  IB_VERCEL_BLOB_STORE_ID?: string;
  BLOB_STORE_ID?: string;
}>;

function fail(reason: string): never {
  throw new Error(`${VERCEL_BLOB_CONFIG_ERROR}:${reason}`);
}

function required(env: Environment, name: keyof Environment): string {
  const value = env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  if (/[\r\n\0]/.test(value)) fail(`${name} contains unsafe control characters`);
  return value;
}

function optionalSafe(env: Environment, name: keyof Environment): string | undefined {
  const value = env[name]?.trim();
  if (!value) return undefined;
  if (/[\r\n\0]/.test(value)) fail(`${name} contains unsafe control characters`);
  return value;
}

export function readVercelBlobAuthConfig(
  env: Environment = {
    IB_VERCEL_BLOB_AUTH_MODE: process.env.IB_VERCEL_BLOB_AUTH_MODE,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    IB_VERCEL_BLOB_STORE_ID: process.env.IB_VERCEL_BLOB_STORE_ID,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
  },
): VercelBlobAuthConfig {
  const explicitMode = optionalSafe(env, "IB_VERCEL_BLOB_AUTH_MODE");
  const mode = explicitMode ?? (optionalSafe(env, "BLOB_READ_WRITE_TOKEN") ? "read-write-token" : undefined);
  if (!mode) fail("missing IB_VERCEL_BLOB_AUTH_MODE");

  if (mode === "read-write-token") {
    return {
      mode,
      token: required(env, "BLOB_READ_WRITE_TOKEN"),
    };
  }

  if (mode === "oidc") {
    const storeId = optionalSafe(env, "IB_VERCEL_BLOB_STORE_ID") ?? optionalSafe(env, "BLOB_STORE_ID");
    if (!storeId) fail("missing IB_VERCEL_BLOB_STORE_ID or BLOB_STORE_ID");
    return {
      mode,
      oidcToken: required(env, "VERCEL_OIDC_TOKEN"),
      storeId,
    };
  }

  fail(`unsupported IB_VERCEL_BLOB_AUTH_MODE:${mode}`);
}

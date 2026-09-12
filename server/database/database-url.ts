import "server-only";

import { stabilizePostgresSslMode } from "@/lib/database/postgres-ssl";

export const DATABASE_CONFIG_ERROR = "DATABASE_CONFIG_ERROR";

function fail(): never {
  throw new Error(`${DATABASE_CONFIG_ERROR}:DATABASE_URL`);
}

export function readPostgresDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl || /[\r\n\0]/.test(databaseUrl)) fail();

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail();
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") fail();
  if (!parsed.hostname || parsed.pathname === "/" || parsed.pathname === "") fail();
  if (parsed.hash) fail();

  return stabilizePostgresSslMode(databaseUrl);
}

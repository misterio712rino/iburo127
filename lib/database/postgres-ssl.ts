export const POSTGRES_EXPLICIT_STRICT_SSL_MODE = "verify-full";

const CURRENT_VERIFY_FULL_ALIASES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Preserve the strict TLS certificate + hostname verification semantics that
 * pg@8 currently applies to prefer/require/verify-ca before pg@9 adopts the
 * weaker libpq meanings for those modes.
 *
 * The caller is responsible for validating that the input is a PostgreSQL URL.
 */
export function stabilizePostgresSslMode(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get("sslmode")?.trim().toLowerCase();

  if (!sslMode || !CURRENT_VERIFY_FULL_ALIASES.has(sslMode)) {
    return databaseUrl;
  }

  parsed.searchParams.set("sslmode", POSTGRES_EXPLICIT_STRICT_SSL_MODE);
  return parsed.toString();
}

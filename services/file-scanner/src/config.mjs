import { isIP } from "node:net";

function requiredSecret(env) {
  const secret = env.IB_FILE_SCANNER_SECRET;
  if (typeof secret !== "string" || secret.length < 32 || /[\u0000-\u001f\u007f]/.test(secret)) {
    throw new Error("SCANNER_CONFIG_INVALID");
  }
  return secret;
}

function integer(env, name, fallback, minimum, maximum) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^(0|[1-9]\d*)$/.test(raw)) throw new Error("SCANNER_CONFIG_INVALID");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error("SCANNER_CONFIG_INVALID");
  }
  return value;
}

export function readScannerConfig(env = process.env) {
  const clamdHost = env.IB_SCANNER_CLAMD_HOST || "127.0.0.1";
  if (isIP(clamdHost) === 0 || (clamdHost !== "127.0.0.1" && clamdHost !== "::1")) {
    throw new Error("SCANNER_CONFIG_INVALID");
  }

  const config = {
    secret: requiredSecret(env),
    host: env.IB_SCANNER_HOST || "0.0.0.0",
    port: integer(env, "IB_SCANNER_PORT", 8080, 1, 65_535),
    concurrency: integer(env, "IB_SCANNER_MAX_CONCURRENCY", 2, 1, 8),
    requestBodyTimeoutMs: integer(env, "IB_SCANNER_REQUEST_BODY_TIMEOUT_MS", 5_000, 100, 10_000),
    dnsTimeoutMs: integer(env, "IB_SCANNER_DNS_TIMEOUT_MS", 2_000, 100, 10_000),
    connectTimeoutMs: integer(env, "IB_SCANNER_CONNECT_TIMEOUT_MS", 5_000, 100, 15_000),
    downloadTimeoutMs: integer(env, "IB_SCANNER_DOWNLOAD_TIMEOUT_MS", 40_000, 1_000, 50_000),
    clamdConnectTimeoutMs: integer(env, "IB_SCANNER_CLAMD_CONNECT_TIMEOUT_MS", 3_000, 100, 10_000),
    clamdScanTimeoutMs: integer(env, "IB_SCANNER_CLAMD_SCAN_TIMEOUT_MS", 45_000, 1_000, 50_000),
    totalTimeoutMs: integer(env, "IB_SCANNER_TOTAL_TIMEOUT_MS", 55_000, 1_000, 55_000),
    clamdHost,
    clamdPort: integer(env, "IB_SCANNER_CLAMD_PORT", 3310, 1, 65_535),
    signatureDirectory: env.IB_SCANNER_SIGNATURE_DIRECTORY || "/var/lib/clamav",
    signatureMaxAgeHours: integer(env, "IB_SCANNER_SIGNATURE_MAX_AGE_HOURS", 24, 1, 168),
  };

  if (!config.host || /[\r\n\0]/.test(config.host) || !config.signatureDirectory) {
    throw new Error("SCANNER_CONFIG_INVALID");
  }
  return Object.freeze(config);
}

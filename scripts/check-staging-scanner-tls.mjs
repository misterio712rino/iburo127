import tls from "node:tls";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const STAGING_SCANNER_HOST = "scanner-v2-staging.iburo127.online";
export const EXPIRY_WARNING_DAYS = 30;
const DAY_MS = 86_400_000;

export function assessCertificateExpiry(validTo, nowMs = Date.now(), minDays = EXPIRY_WARNING_DAYS) {
  const expiresMs = Date.parse(validTo ?? "");
  if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs)) throw new Error("INVALID_CERTIFICATE_DATE");
  const remainingMs = expiresMs - nowMs;
  if (remainingMs <= 0) throw new Error("CERTIFICATE_EXPIRED");
  if (remainingMs <= minDays * DAY_MS) throw new Error("CERTIFICATE_RENEWAL_REQUIRED");
  return { expiresAt: new Date(expiresMs).toISOString(), remainingDays: Math.floor(remainingMs / DAY_MS) };
}

export function inspectTlsCertificate({ host = STAGING_SCANNER_HOST, timeoutMs = 10_000 } = {}) {
  if (host !== STAGING_SCANNER_HOST) throw new Error("TARGET_NOT_STAGING_SCANNER");
  return new Promise((resolveResult, rejectResult) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true });
    let settled = false;
    function finish(error, result) {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) rejectResult(error);
      else resolveResult(result);
    }
    socket.setTimeout(timeoutMs, () => finish(new Error("TLS_TIMEOUT")));
    socket.once("error", () => finish(new Error("TLS_HANDSHAKE_FAILED")));
    socket.once("secureConnect", () => {
      if (!socket.authorized) return finish(new Error("TLS_UNTRUSTED_CERTIFICATE"));
      const certificate = socket.getPeerCertificate();
      if (!certificate?.raw || tls.checkServerIdentity(host, certificate)) {
        return finish(new Error("TLS_HOSTNAME_MISMATCH"));
      }
      try {
        finish(null, assessCertificateExpiry(certificate.valid_to));
      } catch (error) {
        finish(error);
      }
    });
  });
}

async function main() {
  try {
    const result = await inspectTlsCertificate();
    console.log(`STAGING_SCANNER_TLS_PASS expires=${result.expiresAt} remaining_days=${result.remainingDays}`);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    console.error(`STAGING_SCANNER_TLS_FAIL:${code}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

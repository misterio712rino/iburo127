import { X509Certificate, createPrivateKey, createPublicKey, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const STAGING_SCANNER_HOST = "scanner-v2-staging.iburo127.online";
export const CERT_PAIR_FAIL = "STAGING_SCANNER_CERT_PAIR_FAIL";
const MIN_REMAINING_MS = 30 * 24 * 60 * 60 * 1000;

function fail(reason) {
  const error = new Error(`${CERT_PAIR_FAIL}: ${reason}`);
  error.code = CERT_PAIR_FAIL;
  throw error;
}

function parseTime(value, label) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`invalid-${label}`);
  return ms;
}

function publicDer(key) {
  return Buffer.from(createPublicKey(key).export({ type: "spki", format: "der" }));
}

function safeKeyPermissions(path, platform) {
  if (platform === "win32") return;
  const mode = statSync(path).mode & 0o777;
  if ((mode & 0o077) !== 0) fail("private-key-permissions");
}
export function validateStagingScannerCertPair({
  certPath, keyPath, currentNotAfter, now = Date.now(), platform = process.platform,
}) {
  if (!certPath || !keyPath || !currentNotAfter) fail("missing-input");
  safeKeyPermissions(keyPath, platform);

  let cert;
  let privateKey;
  try {
    cert = new X509Certificate(readFileSync(certPath));
    privateKey = createPrivateKey(readFileSync(keyPath));
  } catch {
    fail("unreadable-or-invalid-pem");
  }

  if (cert.checkHost(STAGING_SCANNER_HOST) !== STAGING_SCANNER_HOST) {
    fail("hostname-mismatch");
  }
  const notBefore = parseTime(cert.validFrom, "not-before");
  const notAfter = parseTime(cert.validTo, "not-after");
  const installedNotAfter = parseTime(currentNotAfter, "current-not-after");
  if (notBefore > now + 5 * 60 * 1000) fail("not-yet-valid");
  if (notAfter - now <= MIN_REMAINING_MS) fail("insufficient-lifetime");
  if (notAfter <= installedNotAfter) fail("not-newer-than-installed");

  const certPublic = Buffer.from(cert.publicKey.export({ type: "spki", format: "der" }));
  const keyPublic = publicDer(privateKey);
  if (certPublic.length !== keyPublic.length || !timingSafeEqual(certPublic, keyPublic)) {
    fail("certificate-key-mismatch");
  }
  return { hostname: STAGING_SCANNER_HOST, notAfter: new Date(notAfter).toISOString() };
}
function readCliArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail("invalid-cli");
    values.set(key, value);
  }
  return {
    certPath: values.get("--cert"),
    keyPath: values.get("--key"),
    currentNotAfter: values.get("--current-not-after"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateStagingScannerCertPair(readCliArgs(process.argv.slice(2)));
    console.log(`STAGING_SCANNER_CERT_PAIR_PASS expires=${result.notAfter}`);
  } catch (error) {
    const marker = error?.code === CERT_PAIR_FAIL ? error.message : CERT_PAIR_FAIL;
    console.error(marker);
    process.exitCode = 1;
  }
}

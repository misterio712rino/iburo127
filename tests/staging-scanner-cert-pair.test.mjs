import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CERT_PAIR_FAIL,
  STAGING_SCANNER_HOST,
  validateStagingScannerCertPair,
} from "../scripts/validate-staging-scanner-cert-pair.mjs";

const WINDOWS_OPENSSL = "C:/Program Files/Git/usr/bin/openssl.exe";
function openssl(args) {
  const executable = process.platform === "win32" && existsSync(WINDOWS_OPENSSL) ? WINDOWS_OPENSSL : "openssl";
  const result = spawnSync(executable, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function pair(dir, name, hostname = STAGING_SCANNER_HOST) {
  const certPath = join(dir, `${name}.crt`);
  const keyPath = join(dir, `${name}.key`);
  openssl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "90",
    "-subj", `/CN=${hostname}`, "-addext", `subjectAltName=DNS:${hostname}`,
  ]);
  chmodSync(keyPath, 0o600);
  return { certPath, keyPath };
}
function expiry(certPath) {
  return Date.parse(new X509Certificate(readFileSync(certPath)).validTo);
}

function expectDenied(fn, reason) {
  assert.throws(fn, new RegExp(`${CERT_PAIR_FAIL}: ${reason}`));
}

test("accepts exact hostname, matching key and strictly newer certificate", () => {
  const dir = mkdtempSync(join(tmpdir(), "iburo-cert-"));
  try {
    const candidate = pair(dir, "candidate");
    const notAfter = expiry(candidate.certPath);
    const result = validateStagingScannerCertPair({
      ...candidate,
      currentNotAfter: new Date(notAfter - 24 * 60 * 60 * 1000).toISOString(),
      platform: process.platform,
    });
    assert.equal(result.hostname, STAGING_SCANNER_HOST);
    assert.equal(Date.parse(result.notAfter), notAfter);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects certificate and private key from different pairs", () => {
  const dir = mkdtempSync(join(tmpdir(), "iburo-cert-"));
  try {
    const first = pair(dir, "first");
    const second = pair(dir, "second");
    expectDenied(() => validateStagingScannerCertPair({
      certPath: first.certPath, keyPath: second.keyPath,
      currentNotAfter: new Date(expiry(first.certPath) - 86_400_000).toISOString(), platform: process.platform,
    }), "certificate-key-mismatch");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("rejects a certificate for another hostname", () => {
  const dir = mkdtempSync(join(tmpdir(), "iburo-cert-"));
  try {
    const candidate = pair(dir, "wrong-host", "example.invalid");
    expectDenied(() => validateStagingScannerCertPair({
      ...candidate,
      currentNotAfter: new Date(expiry(candidate.certPath) - 86_400_000).toISOString(), platform: process.platform,
    }), "hostname-mismatch");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rejects a candidate that is not newer than installed certificate", () => {
  const dir = mkdtempSync(join(tmpdir(), "iburo-cert-"));
  try {
    const candidate = pair(dir, "same-expiry");
    const installed = new Date(expiry(candidate.certPath)).toISOString();
    expectDenied(() => validateStagingScannerCertPair({
      ...candidate, currentNotAfter: installed, platform: process.platform,
    }), "not-newer-than-installed");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rejects group/world-readable candidate private keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "iburo-cert-"));
  try {
    const candidate = pair(dir, "permissions");
    chmodSync(candidate.keyPath, 0o644);
    expectDenied(() => validateStagingScannerCertPair({
      ...candidate,
      currentNotAfter: new Date(expiry(candidate.certPath) - 86_400_000).toISOString(), platform: "linux",
    }), "private-key-permissions");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

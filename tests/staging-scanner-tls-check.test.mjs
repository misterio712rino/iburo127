import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCertificateExpiry,
  inspectTlsCertificate,
  STAGING_SCANNER_HOST,
} from "../scripts/check-staging-scanner-tls.mjs";

const now = Date.parse("2026-09-22T10:00:00Z");
const day = 86_400_000;
const dateAfter = (days) => new Date(now + days * day).toUTCString();

test("sufficient remaining lifetime passes without secret access", () => {
  const result = assessCertificateExpiry(dateAfter(89), now);
  assert.equal(result.remainingDays, 89);
  assert.equal(result.expiresAt, new Date(now + 89 * day).toISOString());
});

test("fails closed on invalid and expired certificates", () => {
  assert.throws(() => assessCertificateExpiry("not-a-date", now), /INVALID_CERTIFICATE_DATE/);
  assert.throws(() => assessCertificateExpiry(dateAfter(-1), now), /CERTIFICATE_EXPIRED/);
  assert.throws(() => assessCertificateExpiry(dateAfter(0), now), /CERTIFICATE_EXPIRED/);
});

test("fails at and below thirty-day renewal window", () => {
  assert.throws(() => assessCertificateExpiry(dateAfter(29), now), /CERTIFICATE_RENEWAL_REQUIRED/);
  assert.throws(() => assessCertificateExpiry(dateAfter(30), now), /CERTIFICATE_RENEWAL_REQUIRED/);
  assert.equal(assessCertificateExpiry(dateAfter(31), now).remainingDays, 31);
});

test("rejects alternative hosts before opening any connection", async () => {
  assert.equal(STAGING_SCANNER_HOST, "scanner-v2-staging.iburo127.online");
  assert.throws(
    () => inspectTlsCertificate({ host: "iburo127.online" }),
    /TARGET_NOT_STAGING_SCANNER/,
  );
});

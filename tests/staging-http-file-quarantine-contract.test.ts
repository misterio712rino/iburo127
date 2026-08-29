import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/verify-staging-http-mutations.ts"), "utf8");

assert.match(source, /\| "PENDING_SCAN"/);
assert.match(source, /\| "SCANNING"/);
assert.match(source, /\| "QUARANTINED"/);
assert.match(source, /\| "SCAN_FAILED"/);
assert.match(source, /completed\.status !== "PENDING_SCAN"/);
assert.doesNotMatch(source, /completed\.status !== "READY"/);
assert.match(source, /PENDING_SCAN file must not appear in the normal authoritative list/);
assert.match(source, /"PENDING_SCAN file get"[\s\S]*?404,[\s\S]*?"NOT_FOUND"/);
assert.match(source, /"PENDING_SCAN file download"[\s\S]*?404,[\s\S]*?"NOT_FOUND"/);
assert.match(source, /IB_STAGING_FILE_SCAN_E2E/);
assert.match(source, /IB_STAGING_FILE_SCAN_E2E_CONFIRM/);
assert.match(source, /IB_STAGING_FILE_SCAN_E2E_MAX_RUNS/);
assert.match(source, /\/api\/internal\/maintenance\/file-scans/);
assert.match(source, /authorization: `Bearer \$\{secret\}`/);
assert.match(source, /readBoundedPositiveInteger\("IB_STAGING_FILE_SCAN_E2E_MAX_RUNS", 5, 20\)/);
assert.match(source, /file\.status === "READY"/);
assert.doesNotMatch(source, /prisma\./i);
assert.doesNotMatch(source, /scanLeaseToken/i);
assert.doesNotMatch(source, /markUploadReady/i);

console.log("STAGING_HTTP_FILE_QUARANTINE_CONTRACT_TEST_PASS");

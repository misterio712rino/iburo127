import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/verify-vercel-preview-identity.ts"), "utf8");

assert.match(source, /\/\^\[a-f0-9\]\{40\}\$\/\.test/);
assert.match(source, /url\.protocol !== "https:"/);
assert.match(source, /url\.username \|\| url\.password/);
assert.match(source, /redirect: "error"/);
assert.match(source, /REQUEST_TIMEOUT_MS = 10_000/);
assert.match(source, /16_384/);
assert.match(source, /identity\.environment !== "preview"/);
assert.match(source, /identity\.branch !== VERCEL_STAGING_BRANCH/);
assert.match(source, /identity\.runtimeTarget !== "staging"/);
assert.match(source, /identity\.backendEnabled !== false/);
assert.match(source, /Object\.keys\(identity\)\.sort/);
assert.match(source, /VERCEL_PREVIEW_IDENTITY_PASS/);

for (const forbidden of [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "OPENAI_API_KEY",
  "YANDEX_STORAGE_SECRET_ACCESS_KEY",
  "YANDEX_POSTBOX_SECRET_ACCESS_KEY",
  "IB_FILE_SCANNER_SECRET",
  "IB_MAINTENANCE_SECRET",
  "BITRIX24_WEBHOOK_URL",
]) {
  assert.doesNotMatch(source, new RegExp(forbidden), `${forbidden} must not be consumed by preview identity verifier`);
}

console.log("VERCEL_PREVIEW_IDENTITY_VERIFIER_CONTRACT_PASS");

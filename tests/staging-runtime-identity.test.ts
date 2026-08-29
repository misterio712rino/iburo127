import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("app/_iburo/staging-identity/route.ts"), "utf8");

assert.match(source, /VERCEL_GIT_COMMIT_SHA/);
assert.match(source, /VERCEL_GIT_COMMIT_REF/);
assert.match(source, /IB_RUNTIME_TARGET/);
assert.match(source, /isVercelPreviewBackendAllowed/);
assert.match(source, /Cache-Control": "private, no-store, max-age=0"/);
assert.match(source, /X-Content-Type-Options": "nosniff"/);
assert.match(source, /\^\[a-f0-9\]\{40\}\$/i);
assert.match(source, /branch:.*VERCEL_STAGING_BRANCH/s);

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
  assert.doesNotMatch(source, new RegExp(forbidden), `${forbidden} must not be exposed by staging identity`);
}

console.log("STAGING_RUNTIME_IDENTITY_CONTRACT_PASS");

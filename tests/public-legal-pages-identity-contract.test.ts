import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

for (const path of [
  "app/(public)/privacy/page.tsx",
  "app/(public)/offer/page.tsx",
]) {
  const source = await readFile(resolve(path), "utf8");

  assert.ok(
    source.includes("iБюро"),
    `${path} must identify the current iБюро public service`,
  );
  assert.ok(
    source.includes('href="mailto:127pro@mail.ru"'),
    `${path} must use the published actionable contact email`,
  );
  assert.doesNotMatch(
    source,
    /127PRO|info@127pro\.ru/i,
    `${path} must not return to legacy 127PRO identity or obsolete email`,
  );
}

console.log("PUBLIC_LEGAL_PAGES_IDENTITY_CONTRACT_TEST_PASS");

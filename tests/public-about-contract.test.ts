import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("app/(public)/about/page.tsx"), "utf8");

assert.ok(source.includes("iБюро"), "about page must use the current iБюро identity");
assert.doesNotMatch(source, /127PRO/, "about page must not return to the legacy 127PRO identity");
assert.ok(
  source.includes('href="/praktikum"'),
  "about primary access CTA must target the existing /praktikum route",
);
assert.doesNotMatch(
  source,
  /href="\/services\/praktikum"/,
  "about CTA must not return to the nonexistent /services/praktikum route",
);
assert.ok(
  source.includes('href="/bankruptcy-check"'),
  "about preliminary check CTA must target the existing bankruptcy check route",
);

console.log("PUBLIC_ABOUT_CONTRACT_TEST_PASS");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const footerSource = await readFile(resolve("components/layout/Footer.tsx"), "utf8");
const contactsSource = await readFile(resolve("app/(public)/contacts/page.tsx"), "utf8");

for (const [surface, source] of [
  ["footer", footerSource],
  ["contacts", contactsSource],
] as const) {
  assert.ok(
    source.includes('href: "https://t.me/iburo127"') ||
      source.includes('href="https://t.me/iburo127"'),
    `${surface} Telegram contact must target https://t.me/iburo127`,
  );
  assert.doesNotMatch(
    source,
    /https:\/\/t\.me\/(?:["'])/,
    `${surface} must not fall back to the generic Telegram homepage`,
  );
}

assert.match(
  contactsSource,
  /<a[\s\S]*?href="https:\/\/t\.me\/iburo127"[\s\S]*?>[\s\S]*?@iburo127[\s\S]*?<\/a>/,
  "published Telegram handle must be actionable on the contacts page",
);

console.log("PUBLIC_CONTACT_LINKS_CONTRACT_TEST_PASS");

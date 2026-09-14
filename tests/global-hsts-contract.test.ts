import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("next.config.ts"), "utf8");

assert.match(
  source,
  /const transportSecurityHeaders = \[[\s\S]*?Strict-Transport-Security", value: "max-age=31536000"[\s\S]*?\] as const;/,
  "HSTS must remain isolated in the transport-security header bundle",
);
assert.match(
  source,
  /source: "\/:path\*",[\s\S]*?headers: \[\.\.\.transportSecurityHeaders\]/,
  "HSTS must apply to every application route, including the root redirect",
);

const platformSecurityHeadersMatch = source.match(
  /const platformSecurityHeaders = \[([\s\S]*?)\n\] as const;/,
);
assert.ok(platformSecurityHeadersMatch, "platformSecurityHeaders declaration must remain explicit");
assert.doesNotMatch(
  platformSecurityHeadersMatch[1] ?? "",
  /Strict-Transport-Security/,
  "route-specific platform bundles must not duplicate the global HSTS header",
);

const privatePageSecurityHeadersMatch = source.match(
  /const privatePageSecurityHeaders = \[([\s\S]*?)\n\] as const;/,
);
assert.ok(
  privatePageSecurityHeadersMatch,
  "privatePageSecurityHeaders declaration must remain explicit",
);
const privatePageSecurityHeadersBody = privatePageSecurityHeadersMatch[1] ?? "";
assert.match(
  privatePageSecurityHeadersBody,
  /Referrer-Policy", value: "no-referrer"/,
  "private HTML pages must suppress Referer so recovery tokens and portal identifiers cannot escape through same-origin referrers",
);
assert.doesNotMatch(
  privatePageSecurityHeadersBody,
  /strict-origin-when-cross-origin/,
  "private HTML pages must not inherit the less restrictive platform referrer policy",
);
assert.match(
  source,
  /const privatePageHeaders = \[[\s\S]*?\.\.\.privatePageSecurityHeaders[\s\S]*?\] as const;/,
  "private page cache headers must preserve the dedicated no-referrer security bundle",
);
for (const privatePageSource of ["/auth/:path*", "/portal/:path*"]) {
  assert.match(
    source,
    new RegExp(`source: "${privatePageSource.replaceAll("/", "\\/").replace(":path*", ":path\\*")}",[\\s\\S]*?headers: \\[\\.\\.\\.privatePageHeaders\\]`),
    `${privatePageSource} must use the private no-referrer page bundle`,
  );
}

console.log("GLOBAL_HSTS_CONTRACT_TEST_PASS");

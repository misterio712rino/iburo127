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

console.log("GLOBAL_HSTS_CONTRACT_TEST_PASS");

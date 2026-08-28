import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("next.config.ts"), "utf8");

for (const directive of [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' https://storage.yandexcloud.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
]) {
  assert.ok(source.includes(directive), `missing CSP directive: ${directive}`);
}

assert.match(source, /process\.env\.NODE_ENV === "development"/);
assert.match(source, /\? " 'unsafe-eval'" : ""/);
assert.match(source, /\? " ws: http:" : ""/);
assert.doesNotMatch(
  source,
  /connect-src 'self' https:\/\/storage\.yandexcloud\.net https:\/\//,
  "CSP must not add an unrestricted extra HTTPS source",
);

for (const protectedPageSource of ["/auth/:path*", "/portal/:path*"]) {
  assert.ok(source.includes(`source: "${protectedPageSource}"`));
}
assert.match(source, /source: "\/auth\/:path\*",[\s\S]*?headers: \[\.\.\.privatePageHeaders\]/);
assert.match(source, /source: "\/portal\/:path\*",[\s\S]*?headers: \[\.\.\.privatePageHeaders\]/);
assert.match(source, /source: "\/app\/:path\*",[\s\S]*?headers: \[\.\.\.platformPageSecurityHeaders\]/);

assert.match(source, /X-Content-Type-Options", value: "nosniff"/);
assert.match(source, /X-Frame-Options", value: "DENY"/);
assert.match(source, /Referrer-Policy", value: "strict-origin-when-cross-origin"/);
assert.match(source, /Permissions-Policy", value: "camera=\(\), microphone=\(\), geolocation=\(\)"/);
assert.match(source, /Cache-Control", value: "private, no-store, max-age=0"/);

const privateApiHeadersMatch = source.match(
  /const privateApiHeaders = \[([\s\S]*?)\n\] as const;/,
);
assert.ok(privateApiHeadersMatch, "privateApiHeaders declaration must remain explicit");
const privateApiHeadersBody = privateApiHeadersMatch[1] ?? "";
assert.match(privateApiHeadersBody, /\.\.\.platformSecurityHeaders/);
assert.match(privateApiHeadersBody, /Cache-Control/);
assert.doesNotMatch(
  privateApiHeadersBody,
  /platformPageSecurityHeaders|Content-Security-Policy/,
  "API responses should not carry the HTML CSP bundle",
);

console.log("SECURITY_HEADERS_CONTRACT_TEST_PASS");

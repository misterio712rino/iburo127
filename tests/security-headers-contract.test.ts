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

const publicLayoutSource = await readFile(resolve("app/(public)/layout.tsx"), "utf8");
assert.match(
  publicLayoutSource,
  /metadataBase:\s*new URL\("https:\/\/www\.iburo127\.ru"\)/,
  "public canonical metadata must use the production iБюро domain",
);
assert.match(
  publicLayoutSource,
  /url:\s*"https:\/\/www\.iburo127\.ru"/,
  "OpenGraph URL must use the production iБюро domain",
);
assert.doesNotMatch(
  publicLayoutSource,
  /iburo127\.online/,
  "legacy .online canonical domain must not return",
);

const publicHomeSource = await readFile(resolve("app/(public)/page.tsx"), "utf8");
for (const publicSection of [
  "Hero",
  "AboutCompany",
  "WhyChooseUs",
  "PracticeHighlight",
  "ReviewsPreview",
  "FAQPreview",
  "ContactCTA",
]) {
  assert.match(
    publicHomeSource,
    new RegExp(`<${publicSection}\\s*/>`),
    `public homepage must render ${publicSection}`,
  );
}
assert.doesNotMatch(
  publicHomeSource,
  /from "next\/navigation"|redirect\("\/app"\)/,
  "public homepage must not redirect visitors into the investor/demo /app surface",
);

const heroSource = await readFile(resolve("components/sections/Hero.tsx"), "utf8");
assert.ok(
  heroSource.includes('href="#how"'),
  "homepage how-it-works CTA must retain its local anchor",
);
assert.match(
  heroSource,
  /id="how"[\s\S]*?Как это работает/,
  "homepage how-it-works CTA must have a matching semantic target",
);

const practiceHighlightSource = await readFile(
  resolve("components/sections/PracticeHighlight.tsx"),
  "utf8",
);
assert.ok(
  practiceHighlightSource.includes('href="/praktikum"'),
  "homepage practicum CTA must target the existing public practicum route",
);
assert.ok(
  !practiceHighlightSource.includes('href="/services/praktikum"'),
  "homepage practicum CTA must not return to the removed nested route",
);

const robotsSource = await readFile(resolve("app/robots.ts"), "utf8");
assert.ok(
  robotsSource.includes('const SITE_URL = "https://www.iburo127.ru";'),
  "robots metadata must use the production iБюро domain",
);
assert.ok(
  robotsSource.includes('sitemap: `${SITE_URL}/sitemap.xml`'),
  "robots metadata must publish the production sitemap location",
);
for (const privatePrefix of ["/api/", "/auth/", "/portal/", "/app/", "/_iburo/"]) {
  assert.ok(
    robotsSource.includes(`"${privatePrefix}"`),
    `robots metadata must disallow ${privatePrefix}`,
  );
}

const sitemapSource = await readFile(resolve("app/sitemap.ts"), "utf8");
assert.ok(
  sitemapSource.includes('const SITE_URL = "https://www.iburo127.ru";'),
  "sitemap must use the production iБюро domain",
);
for (const requiredRoute of [
  "/",
  "/about",
  "/praktikum",
  "/reviews",
  "/faq",
  "/contacts",
  "/calculator",
  "/bankruptcy-check",
  "/articles",
  "/offer",
  "/privacy",
]) {
  assert.ok(
    sitemapSource.includes(`"${requiredRoute}"`),
    `sitemap must include ${requiredRoute}`,
  );
}
for (const excludedRoute of [
  "/api/",
  "/auth/",
  "/portal/",
  "/app/",
  "/_iburo/",
  "/uslugi",
  "/proverka",
  "/oferta",
]) {
  assert.ok(
    !sitemapSource.includes(`"${excludedRoute}"`),
    `sitemap must not include ${excludedRoute}`,
  );
}
assert.doesNotMatch(
  `${robotsSource}\n${sitemapSource}`,
  /iburo127\.online/,
  "legacy .online domain must not return in crawler metadata",
);

const servicesPageSource = await readFile(resolve("app/(public)/services/page.tsx"), "utf8");
assert.ok(
  servicesPageSource.includes('href: "/praktikum"'),
  "services practicum CTA must target the existing public practicum route",
);
assert.ok(
  !servicesPageSource.includes('href: "/services/praktikum"'),
  "services practicum CTA must not return to the removed nested route",
);

const footerSource = await readFile(resolve("components/layout/Footer.tsx"), "utf8");
assert.ok(
  footerSource.includes('href: "https://www.iburo127.ru"'),
  "footer website link must target the production iБюро domain",
);
assert.doesNotMatch(
  footerSource,
  /iburo127\.online/,
  "legacy .online website link must not return in the public footer",
);

const headerSource = await readFile(resolve("components/layout/Header.tsx"), "utf8");
assert.match(
  headerSource,
  /<Link\s+[\s\S]*?href="\/contacts"[\s\S]*?>[\s\S]*?Бесплатная консультация[\s\S]*?<\/Link>/,
  "desktop header consultation CTA must navigate to /contacts",
);
assert.doesNotMatch(
  headerSource,
  /<Button[\s\S]*?Бесплатная консультация[\s\S]*?<\/Button>/,
  "desktop header consultation CTA must not be a non-navigating button",
);

console.log("SECURITY_HEADERS_CONTRACT_TEST_PASS");

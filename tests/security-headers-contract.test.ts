import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  formatPublicContactEmail,
  parsePublicContactRequest,
} from "../server/public-contact/core";

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
assert.match(
  publicHomeSource,
  /import \{ redirect \} from "next\/navigation";/,
  "application root must use a server redirect",
);
assert.match(
  publicHomeSource,
  /redirect\("\/auth\/sign-in"\)/,
  "application root must route directly to sign-in",
);
for (const removedRootSection of [
  "Hero",
  "AboutCompany",
  "WhyChooseUs",
  "PracticeHighlight",
  "ReviewsPreview",
  "FAQPreview",
  "ContactCTA",
]) {
  assert.doesNotMatch(
    publicHomeSource,
    new RegExp(`(?:import|<)${removedRootSection}`),
    `application root must not render marketing section ${removedRootSection}`,
  );
}

const heroSource = await readFile(resolve("components/sections/Hero.tsx"), "utf8");
assert.ok(
  heroSource.includes('href="#how"'),
  "legacy marketing how-it-works CTA must retain its local anchor while the component remains in the repository",
);
assert.match(
  heroSource,
  /id="how"[\s\S]*?Как это работает/,
  "legacy marketing how-it-works CTA must have a matching semantic target",
);

const practiceHighlightSource = await readFile(
  resolve("components/sections/PracticeHighlight.tsx"),
  "utf8",
);
assert.ok(
  practiceHighlightSource.includes('href="/praktikum"'),
  "legacy marketing practicum CTA must target the existing public practicum route",
);
assert.ok(
  !practiceHighlightSource.includes('href="/services/praktikum"'),
  "legacy marketing practicum CTA must not return to the removed nested route",
);

const pricingSource = await readFile(resolve("components/sections/Pricing.tsx"), "utf8");
assert.match(
  pricingSource,
  /name:\s*"Эксклюзив"[\s\S]*?button:\s*"Записаться"[\s\S]*?href:\s*"\/contacts"/,
  "VIP practicum CTA must route to the public contacts flow",
);
assert.doesNotMatch(
  pricingSource,
  /#popup:myform/,
  "legacy constructor popup fragment must not return in active pricing",
);

const contactsPageSource = await readFile(resolve("app/(public)/contacts/page.tsx"), "utf8");
assert.match(
  contactsPageSource,
  /import ContactRequestForm from "@\/components\/sections\/ContactRequestForm"/,
  "contacts page must use the functional intake form",
);
assert.match(
  contactsPageSource,
  /<ContactRequestForm\s*\/>/,
  "contacts page must render the functional intake form",
);

const contactFormSource = await readFile(
  resolve("components/sections/ContactRequestForm.tsx"),
  "utf8",
);
assert.match(contactFormSource, /fetch\("\/api\/public\/contact"/);
for (const fieldName of ["name", "phone", "email", "message", "website", "consent"]) {
  assert.ok(
    contactFormSource.includes(`name="${fieldName}"`),
    `contact form must submit ${fieldName}`,
  );
}
assert.match(contactFormSource, /name="consent"[\s\S]*?required/);
assert.match(contactFormSource, /href="\/privacy"/);

const contactRouteSource = await readFile(resolve("app/api/public/contact/route.ts"), "utf8");
assert.match(contactRouteSource, /evaluatePlatformMutationOrigin\(request\)/);
assert.match(contactRouteSource, /readBoundedJsonBody\(request, PUBLIC_CONTACT_BODY_MAX_BYTES\)/);
assert.match(contactRouteSource, /const PUBLIC_CONTACT_BODY_MAX_BYTES = 8 \* 1024;/);
assert.match(contactRouteSource, /const PUBLIC_CONTACT_RECIPIENT = "127pro@mail\.ru";/);
assert.match(contactRouteSource, /to: PUBLIC_CONTACT_RECIPIENT/);
assert.match(contactRouteSource, /if \(contactRequest\.spam\) \{[\s\S]*?return privateJsonResponse\(\{ ok: true \}\);/);
assert.doesNotMatch(contactRouteSource, /console\.(?:log|info|warn|error|debug)/);

const validContactRequest = parsePublicContactRequest({
  name: " Иван Иванов ",
  phone: "+7 (999) 123-45-67",
  email: " USER@example.com ",
  message: "Нужна консультация",
  website: "",
  consent: true,
});
assert.equal(validContactRequest.name, "Иван Иванов");
assert.equal(validContactRequest.email, "user@example.com");
assert.equal(validContactRequest.spam, false);
assert.match(formatPublicContactEmail(validContactRequest), /Иван Иванов/);
assert.throws(
  () =>
    parsePublicContactRequest({
      name: "Иван",
      phone: "",
      email: "",
      message: "",
      website: "",
      consent: true,
    }),
  /PUBLIC_CONTACT_INVALID:CONTACT_METHOD/,
);
assert.throws(
  () =>
    parsePublicContactRequest({
      name: "Иван",
      phone: "+79991234567",
      email: "",
      message: "",
      website: "",
      consent: false,
    }),
  /PUBLIC_CONTACT_INVALID:CONSENT/,
);
const honeypotContactRequest = parsePublicContactRequest({
  name: "Bot",
  phone: "+79991234567",
  email: "",
  message: "",
  website: "https://spam.example",
  consent: true,
});
assert.equal(honeypotContactRequest.spam, true);

const bankruptcyCheckSource = await readFile(
  resolve("app/(public)/bankruptcy-check/page.tsx"),
  "utf8",
);
assert.match(
  bankruptcyCheckSource,
  /import BankruptcyPrecheck from "@\/components\/sections\/BankruptcyPrecheck"/,
  "bankruptcy check page must use the functional preliminary assessment",
);
assert.match(bankruptcyCheckSource, /<BankruptcyPrecheck\s*\/>/);
assert.doesNotMatch(
  bankruptcyCheckSource,
  /Здесь позже будет|интерактивный AI-опросник/,
  "public bankruptcy check must not expose a future-placeholder experience",
);

const bankruptcyPrecheckSource = await readFile(
  resolve("components/sections/BankruptcyPrecheck.tsx"),
  "utf8",
);
for (const requiredPhrase of [
  "Предварительная онлайн-проверка",
  "не является юридическим заключением",
  "Есть основания обсудить ситуацию с юристом",
  "Нужна дополнительная оценка ситуации",
  "не подтверждает возможность или невозможность банкротства",
  'href="/contacts"',
]) {
  assert.ok(
    bankruptcyPrecheckSource.includes(requiredPhrase),
    `bankruptcy precheck must preserve safe preliminary wording: ${requiredPhrase}`,
  );
}
assert.doesNotMatch(
  bankruptcyPrecheckSource,
  /вы точно подходите|вы точно не подходите|гарантирован(?:о|ный)|100%|вероятность успешного/i,
  "bankruptcy precheck must not present a final legal conclusion or guaranteed outcome",
);
assert.doesNotMatch(
  bankruptcyPrecheckSource,
  /fetch\(|axios|\/api\//,
  "preliminary bankruptcy answers must remain local and must not be transmitted",
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
  "/services",
  "/praktikum",
  "/faq",
  "/contacts",
  "/calculator",
  "/bankruptcy-check",
  "/offer",
  "/privacy",
]) {
  assert.ok(
    sitemapSource.includes(`"${requiredRoute}"`),
    `sitemap must include ${requiredRoute}`,
  );
}
for (const excludedRoute of [
  "/reviews",
  "/articles",
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

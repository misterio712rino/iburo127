import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const footerSource = await readFile(resolve("components/layout/Footer.tsx"), "utf8");
const contactsSource = await readFile(resolve("app/(public)/contacts/page.tsx"), "utf8");
const aboutSource = await readFile(resolve("app/(public)/about/page.tsx"), "utf8");
const mobileMenuSource = await readFile(resolve("components/layout/MobileMenu.tsx"), "utf8");
const contactFormSource = await readFile(resolve("components/sections/ContactRequestForm.tsx"), "utf8");

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

for (const href of [
  "tel:+78432145640",
  "tel:+79520397884",
  "mailto:127pro@mail.ru",
  "mailto:SRO.GAU@mail.ru",
  "mailto:Bconsalt@internet.ru",
]) {
  assert.ok(
    contactsSource.includes(`href="${href}"`),
    `contacts page must expose actionable contact link: ${href}`,
  );
}

for (const [href, label] of [
  ["tel:+78432145640", "+7 (843) 214-56-40"],
  ["tel:+79520397884", "+7 (952) 039-78-84"],
  ["mailto:127pro@mail.ru", "127pro@mail.ru"],
  ["mailto:SRO.GAU@mail.ru", "SRO.GAU@mail.ru"],
  ["mailto:Bconsalt@internet.ru", "Bconsalt@internet.ru"],
] as const) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    contactsSource,
    new RegExp(`<a[\\s\\S]*?href="${escapedHref}"[\\s\\S]*?>[\\s\\S]*?${escapedLabel}[\\s\\S]*?<\\/a>`),
    `published contact value must remain inside its actionable link: ${label}`,
  );
}

assert.ok(aboutSource.includes("iБюро"), "about page must use the current iБюро identity");
assert.doesNotMatch(aboutSource, /127PRO/, "about page must not return to the legacy 127PRO identity");
assert.ok(
  aboutSource.includes('href="/praktikum"'),
  "about primary access CTA must target the existing /praktikum route",
);
assert.doesNotMatch(
  aboutSource,
  /href="\/services\/praktikum"/,
  "about CTA must not return to the nonexistent /services/praktikum route",
);
assert.ok(
  aboutSource.includes('href="/bankruptcy-check"'),
  "about preliminary check CTA must target the existing bankruptcy check route",
);

for (const requiredMobileDialogContract of [
  'role="dialog"',
  'aria-modal="true"',
  'event.key === "Escape"',
  'event.key !== "Tab"',
  'closeButtonRef.current?.focus()',
  'const triggerButton = triggerRef.current',
  'triggerButton?.focus()',
  'document.body.style.overflow = "hidden"',
  'panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)',
]) {
  assert.ok(
    mobileMenuSource.includes(requiredMobileDialogContract),
    `mobile dialog must preserve keyboard/focus contract: ${requiredMobileDialogContract}`,
  );
}
assert.match(
  mobileMenuSource,
  /if \(event\.shiftKey\)[\s\S]*?last\.focus\(\)[\s\S]*?activeElement === last[\s\S]*?first\.focus\(\)/,
  "mobile dialog must cycle keyboard focus in both directions",
);

for (const [fieldId, label] of [
  ["contact-name", "Ваше имя"],
  ["contact-phone", "Телефон"],
  ["contact-email", "Email"],
  ["contact-message", "Ваш вопрос"],
] as const) {
  assert.ok(
    contactFormSource.includes(`htmlFor="${fieldId}"`),
    `contact form must label ${fieldId}`,
  );
  assert.ok(
    contactFormSource.includes(`id="${fieldId}"`),
    `contact form field ${fieldId} must match its label`,
  );
  assert.ok(
    contactFormSource.includes(label),
    `contact form accessible label must describe ${fieldId}`,
  );
}

for (const [legacyPath, canonicalPath] of [
  ["app/(public)/proverka/page.tsx", "/bankruptcy-check"],
  ["app/(public)/oferta/page.tsx", "/offer"],
  ["app/(public)/uslugi/page.tsx", "/services"],
] as const) {
  const legacySource = await readFile(resolve(legacyPath), "utf8");
  assert.match(
    legacySource,
    /import \{ permanentRedirect \} from "next\/navigation"/,
    `${legacyPath} must use a permanent redirect instead of serving duplicate content`,
  );
  assert.ok(
    legacySource.includes(`permanentRedirect("${canonicalPath}")`),
    `${legacyPath} must redirect to ${canonicalPath}`,
  );
  assert.doesNotMatch(
    legacySource,
    /Здесь будет размещ|canonical:/,
    `${legacyPath} must not return to placeholder or self-canonical content`,
  );
}

const notFoundSource = await readFile(resolve("app/not-found.tsx"), "utf8");
assert.match(notFoundSource, /Страница не найдена/);
assert.ok(notFoundSource.includes('href="/"'), "404 recovery must link to the application root");
assert.ok(notFoundSource.includes('href="/services"'), "404 recovery must link to services");
assert.doesNotMatch(
  notFoundSource,
  /console\.(?:log|info|warn|error|debug)/,
  "404 recovery must not add runtime logging",
);

const publicErrorSource = await readFile(resolve("app/(public)/error.tsx"), "utf8");
assert.match(publicErrorSource, /^"use client";/);
assert.match(publicErrorSource, /onClick=\{reset\}/);
assert.ok(publicErrorSource.includes('href="/"'), "public error recovery must link to the application root");
assert.ok(publicErrorSource.includes('href="/contacts"'), "public error recovery must link to contacts");
assert.doesNotMatch(
  publicErrorSource,
  /error\.message|error\.stack|error\.digest|console\.(?:log|info|warn|error|debug)/,
  "public error recovery must not expose or log runtime error details",
);

const publicLayoutSource = await readFile(resolve("app/(public)/layout.tsx"), "utf8");
const publicHomeSource = await readFile(resolve("app/(public)/page.tsx"), "utf8");
assert.doesNotMatch(
  publicLayoutSource,
  /<main(?:\s|>)/,
  "public layout must not create a main landmark around pages that already own one",
);
assert.match(
  publicLayoutSource,
  /<div className="flex-1">\{children\}<\/div>/,
  "public layout must preserve the flexible content wrapper without using a main landmark",
);
assert.match(
  publicHomeSource,
  /redirect\("\/auth\/sign-in"\)/,
  "application root must redirect to sign-in instead of owning a marketing main landmark",
);
assert.doesNotMatch(
  publicHomeSource,
  /<main(?:\s|>)|<Hero\s*\/>|<ContactCTA\s*\/>/,
  "application root must not render the retired marketing homepage",
);
assert.match(
  contactsSource,
  /<main className=/,
  "representative public subpage must continue to own its main landmark while legacy public routes remain",
);

console.log("PUBLIC_CONTACT_LINKS_CONTRACT_TEST_PASS");

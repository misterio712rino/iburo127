import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalFrameSource = await readFile(resolve("components/portal/PortalFrame.tsx"), "utf8");
const questionnaireSource = await readFile(resolve("app/portal/cases/[caseId]/questionnaire/page.tsx"), "utf8");
const practicumSource = await readFile(resolve("app/portal/cases/[caseId]/practicum/page.tsx"), "utf8");
const practicumComponentSource = await readFile(resolve("components/platform/practicum/ProductionPracticum.tsx"), "utf8");
const documentsSource = await readFile(resolve("app/portal/cases/[caseId]/documents/page.tsx"), "utf8");
const filesSource = await readFile(resolve("app/portal/cases/[caseId]/files/page.tsx"), "utf8");
const aiSource = await readFile(resolve("app/portal/cases/[caseId]/ai/page.tsx"), "utf8");
const securitySource = await readFile(resolve("app/portal/security/page.tsx"), "utf8");
const profileSource = await readFile(resolve("app/portal/profile/page.tsx"), "utf8");
const mfaEnrollmentSource = await readFile(resolve("components/platform/auth/MfaEnrollmentForm.tsx"), "utf8");
const backupCodesSource = await readFile(resolve("components/platform/auth/BackupCodesRegenerator.tsx"), "utf8");
const notificationReadSource = await readFile(resolve("components/platform/notifications/MarkNotificationReadButton.tsx"), "utf8");

assert.match(
  portalFrameSource,
  /\[&_button\]:min-h-11/,
  "production portal buttons must keep a 44px minimum touch target",
);
assert.match(
  portalFrameSource,
  /\[&_a\]:min-h-11/,
  "production portal links must keep a 44px minimum touch target when their display mode supports height",
);
assert.match(
  portalFrameSource,
  /flex-nowrap[^\"]*overflow-x-auto[^\"]*sm:flex-wrap/,
  "mobile portal navigation must stay on one horizontally scrollable row and may wrap again on larger screens",
);
assert.match(
  portalFrameSource,
  /min-h-11 shrink-0[^\"]*whitespace-nowrap/,
  "portal navigation items must remain tappable and must not collapse or wrap their labels",
);
assert.match(questionnaireSource, /text-4xl[^\"]*sm:text-5xl/);
assert.match(practicumSource, /text-4xl[^\"]*sm:text-5xl/);
assert.match(documentsSource, /text-3xl[^\"]*sm:text-5xl/);
assert.match(filesSource, /text-4xl[^\"]*sm:text-5xl/);
assert.match(aiSource, /text-3xl[^\"]*sm:text-5xl/);
assert.match(securitySource, /text-4xl[^\"]*sm:text-5xl/);
assert.match(profileSource, /text-4xl[^\"]*sm:text-5xl/);
assert.match(questionnaireSource, /flex min-w-0 items-start/);
assert.match(practicumSource, /flex min-w-0 items-start/);
assert.match(documentsSource, /flex min-w-0 items-start/);
assert.match(filesSource, /flex min-w-0 items-start/);
assert.match(aiSource, /flex min-w-0 items-center/);
assert.match(securitySource, /min-w-0 max-w-3xl/);
assert.match(profileSource, /grid min-w-0 gap-5/);
assert.match(profileSource, /min-w-0 break-all font-mono/);
assert.match(profileSource, /mt-2 break-all text-sm font-semibold/);
assert.match(
  practicumComponentSource,
  /summary className="inline-flex min-h-11 cursor-pointer items-center/,
  "lesson material disclosure must keep a 44px touch target",
);
assert.match(practicumComponentSource, /role="progressbar"/);
assert.match(practicumComponentSource, /aria-valuenow=\{progressPercent\}/);
assert.match(practicumComponentSource, /role="status"/);
assert.match(backupCodesSource, /aria-busy=\{pending\}/);
assert.match(backupCodesSource, /min-w-0 break-all rounded-xl/);
assert.match(backupCodesSource, /role="status"/);
assert.match(backupCodesSource, /w-full[^\"]*sm:w-auto/);
assert.match(notificationReadSource, /aria-busy=\{pending\}/);
assert.match(notificationReadSource, /flex min-w-0 flex-wrap/);
assert.match(notificationReadSource, /role="alert"/);
assert.match(notificationReadSource, /min-w-0 break-words text-xs/);
assert.doesNotMatch(securitySource, /Account security|определяются только сервером|TOTP/);
assert.doesNotMatch(mfaEnrollmentSource, /Сервис 2FA|TOTP-код|TOTP-приложение/);
assert.doesNotMatch(backupCodesSource, /Сервис 2FA|неожиданный ответ/);

console.log("MOBILE_CRITICAL_PORTAL_CONTRACT_TEST_PASS");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalFrameSource = await readFile(resolve("components/portal/PortalFrame.tsx"), "utf8");
const clientCaseFrameSource = await readFile(resolve("components/portal/ClientCaseFrame.tsx"), "utf8");
const clientCaseNavigationSource = await readFile(resolve("components/portal/ClientCaseNavigation.tsx"), "utf8");
const clientCaseModuleIntroSource = await readFile(resolve("components/portal/ClientCaseModuleIntro.tsx"), "utf8");
const portalNavigationSource = await readFile(resolve("components/portal/PortalNavigation.tsx"), "utf8");
const portalMotionContentSource = await readFile(resolve("components/portal/PortalMotionContent.tsx"), "utf8");
const portalMotionStylesSource = await readFile(resolve("components/portal/PortalMotionStyles.tsx"), "utf8");
const questionnaireSource = await readFile(resolve("app/portal/cases/[caseId]/questionnaire/page.tsx"), "utf8");
const practicumSource = await readFile(resolve("app/portal/cases/[caseId]/practicum/page.tsx"), "utf8");
const practicumComponentSource = await readFile(resolve("components/platform/practicum/ProductionPracticum.tsx"), "utf8");
const documentsSource = await readFile(resolve("app/portal/cases/[caseId]/documents/page.tsx"), "utf8");
const filesSource = await readFile(resolve("app/portal/cases/[caseId]/files/page.tsx"), "utf8");
const productionFilesSource = await readFile(resolve("components/platform/files/ProductionFiles.tsx"), "utf8");
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
  /<PortalNavigation/,
  "portal shell must render the extracted responsive navigation",
);
assert.match(portalFrameSource, /portal-motion-shell/);
assert.match(portalFrameSource, /<PortalMotionContent>/);
assert.match(clientCaseFrameSource, /portal-motion-shell/);
assert.match(clientCaseFrameSource, /<PortalMotionContent>/);
assert.match(portalMotionContentSource, /from "framer-motion"/);
assert.match(portalMotionContentSource, /initial=\{\{ opacity: 0, y: 12 \}\}/);
assert.match(portalMotionContentSource, /duration: 0\.45, ease: "easeOut"/);
assert.match(portalMotionContentSource, /reducedMotion="user"/);
assert.match(portalMotionStylesSource, /translateY\(-4px\)/);
assert.match(portalMotionStylesSource, /transition: width 500ms ease/);
assert.match(portalMotionStylesSource, /iburo-portal-step-ring/);
assert.match(portalMotionStylesSource, /iburo-portal-step-breathe/);
assert.match(portalMotionStylesSource, /iburo-portal-progress-breathe/);
assert.match(portalMotionStylesSource, /prefers-reduced-motion: reduce/);
assert.match(
  portalNavigationSource,
  /flex flex-nowrap[^\"]*overflow-x-auto[^\"]*sm:flex-wrap/,
  "mobile portal navigation must stay on one horizontally scrollable row and may wrap again on larger screens",
);
assert.match(
  portalNavigationSource,
  /min-h-11 shrink-0[^\"]*whitespace-nowrap/,
  "portal navigation items must remain tappable and must not collapse or wrap their labels",
);
assert.match(
  clientCaseNavigationSource,
  /inline-flex min-h-11 shrink-0 items-center rounded-full/,
  "mobile CLIENT navigation items must keep a 44px minimum touch target",
);
assert.match(
  clientCaseNavigationSource,
  /if \(path === "\/portal\/profile"\) return pathname === path \|\| pathname === "\/portal\/security"/,
  "CLIENT account security must keep Profile active in the case navigation",
);

for (const [name, source] of [
  ["questionnaire", questionnaireSource],
  ["practicum", practicumSource],
  ["documents", documentsSource],
  ["files", filesSource],
  ["ai", aiSource],
] as const) {
  assert.match(
    source,
    /<ClientCaseModuleIntro/,
    `${name} CLIENT module must delegate its responsive intro to the reviewed shared boundary`,
  );
}

assert.match(
  clientCaseModuleIntroSource,
  /text-3xl[^\"]*sm:text-5xl/,
  "shared CLIENT module headings must remain compact on mobile and expand on larger screens",
);
assert.match(
  clientCaseModuleIntroSource,
  /inline-flex min-h-11 items-center/,
  "shared CLIENT module back navigation must keep a 44px minimum touch target",
);
assert.match(
  clientCaseModuleIntroSource,
  /flex min-w-0 items-start/,
  "shared CLIENT module intro must preserve shrink-safe mobile layout",
);
assert.match(clientCaseModuleIntroSource, /text-foreground/);
assert.match(clientCaseModuleIntroSource, /text-muted-foreground/);
assert.match(clientCaseModuleIntroSource, /border-border bg-muted text-primary/);

assert.match(
  productionFilesSource,
  /rounded-\[24px\] border border-border bg-card[^\"]*text-card-foreground/,
  "CLIENT file upload surface must inherit the active plan card palette",
);
assert.match(
  productionFilesSource,
  /inline-flex min-h-11[^\"]*bg-primary[^\"]*text-primary-foreground/,
  "CLIENT file upload action must keep a 44px touch target and plan-aware primary treatment",
);
assert.match(
  productionFilesSource,
  /inline-flex min-h-11[^\"]*border border-border bg-background[^\"]*text-foreground/,
  "CLIENT file download action must keep a 44px touch target and semantic surface colors",
);
assert.match(
  productionFilesSource,
  /border border-dashed border-border bg-card\/60[^\"]*text-muted-foreground/,
  "CLIENT empty file state must inherit the plan-aware semantic surface",
);
assert.match(
  productionFilesSource,
  /Режим просмотра сотрудника/,
  "STAFF file view must remain explicitly separate from the CLIENT upload presentation",
);

assert.match(securitySource, /text-4xl[^\"]*sm:text-5xl/);
assert.match(profileSource, /text-4xl[^\"]*sm:text-5xl/);
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

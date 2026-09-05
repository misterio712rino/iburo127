import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const portalFrameSource = await readFile(resolve("components/portal/PortalFrame.tsx"), "utf8");
const portalNavigationSource = await readFile(resolve("components/portal/PortalNavigation.tsx"), "utf8");
const portalMobileDrawerSource = await readFile(resolve("components/portal/PortalMobileDrawer.tsx"), "utf8");
const clientShellV2Source = await readFile(resolve("components/portal/IBuroClientShellV2.tsx"), "utf8");
const questionnaireSource = await readFile(resolve("app/portal/cases/[caseId]/questionnaire/page.tsx"), "utf8");
const questionnaireV2Source = await readFile(resolve("components/platform/questionnaire/IBuroQuestionnaireV2.tsx"), "utf8");
const practicumSource = await readFile(resolve("app/portal/cases/[caseId]/practicum/page.tsx"), "utf8");
const practicumLessonSource = await readFile(resolve("app/portal/cases/[caseId]/practicum/[lessonId]/page.tsx"), "utf8");
const practicumComponentSource = await readFile(resolve("components/platform/practicum/ProductionPracticum.tsx"), "utf8");
const practicumV2Source = await readFile(resolve("components/platform/practicum/IBuroPracticumV2.tsx"), "utf8");
const practicumLessonV2Source = await readFile(resolve("components/platform/practicum/IBuroPracticumLessonV2.tsx"), "utf8");
const documentsSource = await readFile(resolve("app/portal/cases/[caseId]/documents/page.tsx"), "utf8");
const documentsV2Source = await readFile(resolve("components/platform/documents/IBuroDocumentsV2.tsx"), "utf8");
const filesSource = await readFile(resolve("app/portal/cases/[caseId]/files/page.tsx"), "utf8");
const filesV2Source = await readFile(resolve("components/platform/files/IBuroFilesV2.tsx"), "utf8");
const aiSource = await readFile(resolve("app/portal/cases/[caseId]/ai/page.tsx"), "utf8");
const aiMessageSource = await readFile(resolve("components/platform/ai/AiMessage.tsx"), "utf8");
const profileSource = await readFile(resolve("app/portal/profile/page.tsx"), "utf8");
const notificationsSource = await readFile(resolve("app/portal/notifications/page.tsx"), "utf8");
const securitySource = await readFile(resolve("app/portal/security/page.tsx"), "utf8");
const mfaEnrollmentSource = await readFile(resolve("components/platform/auth/MfaEnrollmentForm.tsx"), "utf8");
const backupCodesSource = await readFile(resolve("components/platform/auth/BackupCodesRegenerator.tsx"), "utf8");
const notificationReadSource = await readFile(resolve("components/platform/notifications/MarkNotificationReadButton.tsx"), "utf8");

assert.match(portalFrameSource, /\[&_button\]:min-h-11/, "staff portal buttons must keep a 44px minimum touch target");
assert.match(portalFrameSource, /\[&_a\]:min-h-11/, "staff portal links must keep a 44px minimum touch target");
assert.match(portalFrameSource, /<PortalNavigation/, "staff portal shell must keep responsive navigation");
assert.match(portalNavigationSource, /showProspectLeads \|\| managerNavigationDiscovered/, "staff mobile navigation must preserve authoritative manager discovery");
assert.doesNotMatch(portalNavigationSource, /overflow-x-auto/);
assert.match(portalMobileDrawerSource, /aria-expanded=\{open\}/);
assert.match(portalMobileDrawerSource, /event\.key === "Escape"/);
assert.match(portalMobileDrawerSource, /document\.body\.style\.overflow = "hidden"/);

assert.match(clientShellV2Source, /aria-expanded=\{drawerOpen\}/, "UI v2 hamburger must expose drawer state");
assert.match(clientShellV2Source, /setDrawerOpen\(false\)/, "UI v2 navigation must close the drawer after selection");
assert.match(clientShellV2Source, /\/portal\/notifications\?caseId=\$\{caseId\}/, "UI v2 must preserve authorized selected-case context for Notifications");
assert.match(clientShellV2Source, /\/portal\/profile\?caseId=\$\{caseId\}/, "UI v2 must preserve selected-case context for Profile");
assert.match(clientShellV2Source, /\/portal\/security\?caseId=\$\{caseId\}/, "UI v2 account menu must expose Security");
assert.match(clientShellV2Source, /cases\.length > 1/, "UI v2 must only expose a case switcher when multiple authorized cases exist");
assert.match(clientShellV2Source, /caseDisplayNumber/, "UI v2 must render the user-facing case display number");

for (const [name, routeSource] of [
  ["practicum", practicumSource],
  ["practicum lesson", practicumLessonSource],
  ["questionnaire", questionnaireSource],
  ["documents", documentsSource],
  ["files", filesSource],
  ["ai", aiSource],
  ["profile", profileSource],
  ["notifications", notificationsSource],
  ["security", securitySource],
] as const) {
  assert.match(routeSource, /<IBuroClientShellV2/, `${name} CLIENT module must use the unified responsive UI v2 shell`);
}

assert.match(practicumSource, /<IBuroPracticumV2/, "Practicum CLIENT module must render the dedicated UI v2 presentation");
assert.match(practicumV2Source, /role="progressbar"/);
assert.match(practicumV2Source, /aria-valuenow=\{percent\}/);
assert.match(practicumV2Source, /`\/portal\/cases\/\$\{caseId\}\/practicum\/\$\{lesson\.id\}`/, "Practicum overview must navigate into dedicated lesson workspaces");
assert.doesNotMatch(practicumV2Source, /practicum\/lessons\/complete/, "Practicum overview must not complete lessons inline");

assert.match(practicumLessonSource, /getPracticumLesson\(lessonId\)/, "Practicum lesson route must validate the requested lesson against authoritative content");
assert.match(practicumLessonSource, /resolveCasePortalAudience\(actor, clientCase\)/, "Practicum lesson route must preserve server-authoritative audience resolution");
assert.match(practicumLessonSource, /getPracticumProgress\(sessionProvider, caseId\)/, "Practicum lesson route must read real case-scoped progress");
assert.match(practicumLessonSource, /<IBuroPracticumLessonV2/, "Practicum lesson route must render the production lesson workspace");
assert.match(practicumLessonV2Source, /practicum\/lessons\/complete/, "Lesson workspace must preserve the real completion endpoint");
assert.match(practicumLessonV2Source, /expectedVersion: state\.version/, "Lesson workspace must preserve optimistic versioning");
assert.match(practicumLessonV2Source, /VERSION_CONFLICT/, "Lesson workspace must preserve cross-tab conflict recovery");
assert.match(practicumLessonV2Source, /min-h-11/, "Lesson workspace actions must keep a 44px minimum touch target");
assert.match(practicumLessonV2Source, /role="progressbar"/);
assert.match(practicumLessonV2Source, /aria-valuenow=\{percent\}/);

assert.match(questionnaireSource, /<IBuroQuestionnaireV2/, "Questionnaire CLIENT module must render the dedicated UI v2 presentation");
assert.match(questionnaireV2Source, /role="progressbar"/);
assert.match(questionnaireV2Source, /aria-valuenow=\{progress\}/);
assert.match(questionnaireV2Source, /expectedVersion: state\.version/, "Questionnaire UI v2 must preserve optimistic versioning");
assert.match(questionnaireV2Source, /VERSION_CONFLICT/, "Questionnaire UI v2 must preserve cross-tab conflict recovery");
assert.match(questionnaireV2Source, /isQuestionnaireFieldVisible/, "Questionnaire UI v2 must preserve conditional field visibility");

assert.match(documentsSource, /<IBuroDocumentsV2/, "Documents CLIENT module must render the dedicated UI v2 presentation");
assert.match(documentsV2Source, /role="progressbar"/);
assert.match(documentsV2Source, /expectedVersion: current\?\.version/, "Documents UI v2 must preserve optimistic document versioning");
assert.match(documentsV2Source, /VERSION_CONFLICT/, "Documents UI v2 must preserve cross-tab conflict recovery");
assert.match(documentsV2Source, /send-for-review/, "Documents UI v2 must preserve the real review handoff endpoint");

assert.match(filesSource, /<IBuroFilesV2/, "Files CLIENT module must render the dedicated UI v2 presentation");
assert.match(filesV2Source, /\/api\/platform\/cases\/\$\{caseId\}\/files/, "Files UI v2 must preserve the authorized case-scoped upload/list API");
assert.match(filesV2Source, /\/api\/platform\/files\/\$\{fileId\}\/download/, "Files UI v2 must preserve protected file download handoff");
assert.match(filesV2Source, /MAX_UPLOAD_BYTES = 50 \* 1024 \* 1024/, "Files UI v2 must retain the 50 MB boundary");

assert.match(aiSource, /<AiAssistant caseId=\{clientCase\.id\} withShell=\{false\}/, "AI CLIENT module must preserve the production assistant inside UI v2");
assert.match(aiMessageSource, /min-h-11/, "AI message actions must keep a 44px touch target");

assert.match(notificationsSource, /listNotifications\(sessionProvider, 100\)/, "Notifications inbox must remain account-wide");
assert.match(notificationsSource, /const unreadCount = notifications\.filter\(\(notification\) => !notification\.readAt\)\.length;/, "notification summary must derive unread state from the authorized inbox");
assert.match(notificationsSource, /<time dateTime=\{notification\.createdAt\.toISOString\(\)\}>/, "notification rows must expose semantic timestamps");
assert.match(notificationsSource, /<MarkNotificationReadButton notificationId=\{notification\.id\}/, "unread notifications must retain the real mutation control");
assert.match(notificationReadSource, /aria-busy=\{pending\}/);
assert.match(notificationReadSource, /min-h-11/);
assert.match(notificationReadSource, /role="alert"/);

assert.match(profileSource, /<ProfileAvatarEditor avatarUrl=\{avatarUrl\}/, "Profile must preserve avatar editing");
assert.match(profileSource, /<ProfileDisplayNameEditor displayName=\{storedDisplayName\}/, "Profile must preserve display-name editing against the stored account value");
assert.match(profileSource, /getClientCaseDisplayNumber\(item\.caseNumber\)/, "Profile must never present raw technical case ids as court numbers");
assert.match(profileSource, /min-h-\[52px\]/, "Profile case links must keep a large touch target");
assert.match(profileSource, /min-h-11/, "Profile security action must keep a 44px touch target");

assert.match(securitySource, /resolveProductionAccountSecurityState\(\)/, "Security UI must remain server-authoritative");
assert.match(securitySource, /state\.twoFactorEnabled/, "Security UI must preserve actual 2FA state");
assert.match(securitySource, /<BackupCodesRegenerator \/>/, "Security UI must preserve backup-code regeneration");
assert.match(securitySource, /<MfaEnrollmentForm completionHref=\{completionHref\} \/>/, "Security UI must preserve MFA enrollment");
assert.match(mfaEnrollmentSource, /authClient\.twoFactor\.enable/);
assert.match(mfaEnrollmentSource, /authClient\.twoFactor\.verifyTotp/);
assert.match(mfaEnrollmentSource, /trustDevice: false/);
assert.match(backupCodesSource, /authClient\.twoFactor\.generateBackupCodes/);
assert.match(backupCodesSource, /aria-busy=\{pending\}/);
assert.match(backupCodesSource, /role="status"/);

assert.match(practicumComponentSource, /summary className="inline-flex min-h-11 cursor-pointer items-center/, "legacy staff lesson material disclosure must keep a 44px touch target");
assert.match(practicumComponentSource, /role="progressbar"/);
assert.match(practicumComponentSource, /role="status"/);

console.log("MOBILE_CRITICAL_PORTAL_CONTRACT_TEST_PASS");

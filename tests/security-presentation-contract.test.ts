import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const securityPageSource = await readFile(resolve("app/portal/security/page.tsx"), "utf8");
const enrollmentSource = await readFile(resolve("components/platform/auth/MfaEnrollmentForm.tsx"), "utf8");
const backupCodesSource = await readFile(resolve("components/platform/auth/BackupCodesRegenerator.tsx"), "utf8");

assert.match(securityPageSource, /resolveProductionAccountSecurityState\(\)/);
assert.match(securityPageSource, /state\.status === "UNAUTHENTICATED"\) redirect\("\/auth\/sign-in"\)/);
assert.match(securityPageSource, /<MfaEnrollmentForm completionHref=\{completionHref\} \/>/);
assert.match(securityPageSource, /<BackupCodesRegenerator \/>/);
assert.match(securityPageSource, /min-w-0 max-w-3xl/);
assert.match(securityPageSource, /grid gap-5[\s\S]*lg:grid-cols/);
assert.doesNotMatch(securityPageSource, /localStorage|lib\/platform\/demo|DEMO_/i);

assert.match(enrollmentSource, /authClient\.twoFactor\.enable\(\{[\s\S]*method: "totp"/);
assert.match(enrollmentSource, /authClient\.twoFactor\.verifyTotp\(\{[\s\S]*trustDevice: false/);
assert.match(enrollmentSource, /router\.replace\(completionHref\)[\s\S]*router\.refresh\(\)/);
assert.match(enrollmentSource, /min-h-11 w-full[\s\S]*sm:w-auto/);
assert.match(enrollmentSource, /Шаг 1 из 3[\s\S]*Шаг 2 из 3[\s\S]*Шаг 3 из 3/);
assert.doesNotMatch(enrollmentSource, /localStorage|lib\/platform\/demo|DEMO_/i);

assert.match(backupCodesSource, /authClient\.twoFactor\.generateBackupCodes\(\{ password \}\)/);
assert.match(backupCodesSource, /min-h-11 w-full[\s\S]*sm:w-auto/);
assert.match(backupCodesSource, /role="status"/);
assert.doesNotMatch(backupCodesSource, /localStorage|lib\/platform\/demo|DEMO_/i);

console.log("SECURITY_PRESENTATION_CONTRACT_PASS");

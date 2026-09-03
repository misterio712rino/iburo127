import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const signOutSource = await readFile(resolve("components/platform/auth/SignOutButton.tsx"), "utf8");
const mfaEnrollmentSource = await readFile(resolve("components/platform/auth/MfaEnrollmentForm.tsx"), "utf8");

assert.match(
  signOutSource,
  /className="min-h-11 rounded-full/,
  "sign-out action must keep a 44px minimum touch target independent of the surrounding shell",
);
assert.match(
  mfaEnrollmentSource,
  /onClick=\{copySecret\}[\s\S]*className="mt-3 inline-flex min-h-11 items-center/,
  "MFA secret copy action must keep a 44px minimum touch target",
);
assert.match(mfaEnrollmentSource, /authClient\.twoFactor\.enable/);
assert.match(mfaEnrollmentSource, /authClient\.twoFactor\.verifyTotp/);
assert.match(mfaEnrollmentSource, /trustDevice: false/);

console.log("AUTH_TOUCH_TARGET_CONTRACT_PASS");

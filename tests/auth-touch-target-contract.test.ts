import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const signOutSource = await readFile(resolve("components/platform/auth/SignOutButton.tsx"), "utf8");
const mfaEnrollmentSource = await readFile(resolve("components/platform/auth/MfaEnrollmentForm.tsx"), "utf8");
const authLayoutSource = await readFile(resolve("app/auth/layout.tsx"), "utf8");
const authInteractionSource = await readFile(
  resolve("components/platform/auth/AuthInteractionStyles.tsx"),
  "utf8",
);

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

assert.match(
  authLayoutSource,
  /import \{ AuthInteractionStyles \} from "@\/components\/platform\/auth\/AuthInteractionStyles";/,
  "auth layout must load the shared interaction accessibility layer",
);
assert.match(
  authLayoutSource,
  /auth-interaction-shell[\s\S]*<AuthInteractionStyles \/>/,
  "auth interaction accessibility must stay scoped to the auth layout",
);
assert.match(
  authInteractionSource,
  /\.auth-interaction-shell button \{[\s\S]*min-height: 44px;/,
  "all auth buttons must keep a 44px minimum target",
);
assert.match(
  authInteractionSource,
  /a\[href="\/auth\/sign-in"\][\s\S]*a\[href="\/auth\/forgot-password"\][\s\S]*min-height: 44px;/,
  "standalone sign-in and recovery links must keep 44px minimum targets",
);
assert.match(
  authInteractionSource,
  /:focus-visible \{[\s\S]*outline: 3px solid #7b2330;[\s\S]*outline-offset: 3px;/,
  "auth secondary controls must expose a visible keyboard focus outline",
);
assert.doesNotMatch(
  authInteractionSource,
  /a\[href="\/privacy"\]/,
  "inline privacy copy must not be forced into the standalone auth target treatment",
);

console.log("AUTH_TOUCH_TARGET_CONTRACT_PASS");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const operationsSource = await readFile(resolve("server/account/operations.ts"), "utf8");
const routeSource = await readFile(resolve("app/api/platform/account/profile/route.ts"), "utf8");

assert.match(
  operationsSource,
  /ACCOUNT_PROFILE_EMAIL_CHANGE_REQUIRES_VERIFICATION/,
  "profile operations must expose a stable fail-closed email-change code",
);
assert.match(
  operationsSource,
  /const current = await prisma\.user\.findUnique\([\s\S]*select: \{ email: true, phone: true \}/,
  "contact mutation must load the current domain login email before accepting a submitted email",
);
assert.match(
  operationsSource,
  /const requestedEmail = normalizeContactEmail\(input\.email\);[\s\S]*const currentEmail = current\.email\?\.trim\(\)\.toLowerCase\(\) \?\? null;[\s\S]*if \(requestedEmail !== currentEmail\) \{[\s\S]*ACCOUNT_PROFILE_EMAIL_CHANGE_REQUIRES_VERIFICATION/,
  "a changed email must be rejected before profile persistence until a verified Better Auth change-email flow exists",
);
assert.match(
  operationsSource,
  /const data: \{ phone\?: string \| null \} = \{\};/,
  "profile persistence payload must not directly carry an email field",
);
assert.doesNotMatch(
  operationsSource,
  /data\.email\s*=/,
  "domain profile mutation must never write an unsynchronized login email",
);
assert.match(
  operationsSource,
  /if \(!Object\.keys\(data\)\.length\) \{[\s\S]*return \{ email: current\.email, phone: current\.phone \};/,
  "submitting the unchanged current email must remain a safe no-op",
);
assert.match(
  routeSource,
  /ACCOUNT_PROFILE_EMAIL_CHANGE_REQUIRES_VERIFICATION/,
  "profile API must map the verified-email boundary to a stable public error code",
);
assert.match(
  routeSource,
  /ACCOUNT_PROFILE_EMAIL_CHANGE_REQUIRES_VERIFICATION[\s\S]*409/,
  "profile API must reject unsafe email changes without exposing provider internals",
);

console.log("ACCOUNT_PROFILE_EMAIL_BOUNDARY_PASS");

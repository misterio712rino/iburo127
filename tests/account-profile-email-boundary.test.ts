import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const operationsSource = await readFile(resolve("server/account/operations.ts"), "utf8");
const routeSource = await readFile(resolve("app/api/platform/account/profile/route.ts"), "utf8");
const accessGateSource = await readFile(resolve("server/auth/access-gate.ts"), "utf8");
const editorSource = await readFile(
  resolve("components/platform/account/ProfileAccountEditor.tsx"),
  "utf8",
);

assert.match(
  operationsSource,
  /const data: \{ email\?: string; phone\?: string \| null \} = \{\};/,
  "profile contact mutation must keep supporting a contact email",
);
assert.match(
  operationsSource,
  /data\.email = normalizeContactEmail\(input\.email\)/,
  "submitted profile email must be normalized as contact data",
);
assert.match(
  operationsSource,
  /ACCOUNT_PROFILE_EMAIL_CONFLICT/,
  "contact email uniqueness conflicts must remain a stable profile error",
);
assert.doesNotMatch(
  routeSource,
  /ACCOUNT_PROFILE_EMAIL_CHANGE_REQUIRES_VERIFICATION/,
  "profile API must not misrepresent contact-email editing as Better Auth credential editing",
);
assert.match(
  editorSource,
  /Контактный email для связи и уведомлений\. Адрес входа не изменяется\./,
  "profile UX must state that contact email and credential email are distinct",
);

assert.match(
  accessGateSource,
  /authIdentities: \{ select: \{ provider: true, subject: true \} \}/,
  "access gate must load the verified external auth subject, not infer identity by email",
);
assert.match(
  accessGateSource,
  /function readBetterAuthSubject\([\s\S]*identity\.provider === BETTER_AUTH_PROVIDER[\s\S]*identities\.length !== 1/,
  "login resolution must fail closed unless exactly one Better Auth identity is linked",
);
assert.match(
  accessGateSource,
  /select "email"[\s\S]*from "user"[\s\S]*where "id" = \$\{subject\}[\s\S]*limit 2/,
  "credential email must be resolved from the reviewed Better Auth user table by identity subject",
);
assert.match(
  accessGateSource,
  /const loginEmail = await resolveBetterAuthLoginEmail\(user\);[\s\S]*if \(!loginEmail\) throw new Error\("ACCESS_GATE_ACCOUNT_UNAVAILABLE"\);[\s\S]*return loginEmail;/,
  "challenge exchange must fail closed when the linked Better Auth login email cannot be resolved",
);
assert.doesNotMatch(
  accessGateSource,
  /resolveAccessChallengeToEmail[\s\S]*return user\.email/,
  "challenge exchange must never use mutable profile contact email as the password-login credential",
);

console.log("ACCOUNT_PROFILE_EMAIL_BOUNDARY_PASS");

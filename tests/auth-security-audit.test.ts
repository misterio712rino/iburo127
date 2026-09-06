import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AUTH_SECURITY_EVENT_TYPES,
  classifyBetterAuthSecurityEvents,
  createNonBlockingAuthSecurityAuditDispatcher,
  readBetterAuthHookIdentity,
  type AuthSecurityAuditInput,
  type AuthSecurityAuditRecorder,
} from "@/server/auth/security-audit-core";

const noSession = readBetterAuthHookIdentity({});
assert.deepEqual(noSession, { subject: null, newSessionSubject: null });

const currentSession = readBetterAuthHookIdentity({
  session: { user: { id: " current-subject " } },
});
assert.deepEqual(currentSession, {
  subject: "current-subject",
  newSessionSubject: null,
});

const newSession = readBetterAuthHookIdentity({
  session: { user: { id: "old-subject" } },
  newSession: { user: { id: " new-subject " } },
});
assert.deepEqual(newSession, {
  subject: "new-subject",
  newSessionSubject: "new-subject",
});

assert.deepEqual(
  classifyBetterAuthSecurityEvents("/sign-in/email", newSession),
  [AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS],
);
assert.deepEqual(
  classifyBetterAuthSecurityEvents("/sign-in/email", currentSession),
  [],
  "2FA challenge must not be audited as completed sign-in without a new session",
);
assert.deepEqual(
  classifyBetterAuthSecurityEvents("/two-factor/verify-totp", currentSession),
  [AUTH_SECURITY_EVENT_TYPES.MFA_TOTP_VERIFIED],
);
assert.deepEqual(
  classifyBetterAuthSecurityEvents("/two-factor/verify-totp", newSession),
  [
    AUTH_SECURITY_EVENT_TYPES.MFA_TOTP_VERIFIED,
    AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS,
  ],
);
assert.deepEqual(
  classifyBetterAuthSecurityEvents("/two-factor/verify-backup-code", newSession),
  [
    AUTH_SECURITY_EVENT_TYPES.MFA_BACKUP_CODE_USED,
    AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS,
  ],
);
assert.deepEqual(
  classifyBetterAuthSecurityEvents("/unknown", newSession),
  [],
);
assert.deepEqual(
  classifyBetterAuthSecurityEvents("/two-factor/verify-totp", noSession),
  [],
);

const scheduled: Array<() => Promise<void>> = [];
const recorded: AuthSecurityAuditInput[] = [];
const recorder: AuthSecurityAuditRecorder = {
  async record(input) {
    recorded.push(input);
    return true;
  },
};
const dispatch = createNonBlockingAuthSecurityAuditDispatcher(
  () => recorder,
  (work) => scheduled.push(work),
);

dispatch({
  provider: "better-auth",
  subject: "external-subject",
  type: AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS,
});
assert.equal(scheduled.length, 1);
assert.deepEqual(recorded, []);
await scheduled[0]?.();
assert.deepEqual(recorded, [
  {
    provider: "better-auth",
    subject: "external-subject",
    type: AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS,
  },
]);

const failedScheduled: Array<() => Promise<void>> = [];
const nonBlockingFailure = createNonBlockingAuthSecurityAuditDispatcher(
  () => ({
    async record() {
      throw new Error("sensitive database detail");
    },
  }),
  (work) => failedScheduled.push(work),
);
assert.doesNotThrow(() =>
  nonBlockingFailure({
    provider: "better-auth",
    subject: "subject",
    type: AUTH_SECURITY_EVENT_TYPES.PASSWORD_RESET_COMPLETED,
  }),
);
await assert.doesNotReject(async () => failedScheduled[0]?.());

const getterFailure = createNonBlockingAuthSecurityAuditDispatcher(
  () => {
    throw new Error("configuration detail");
  },
  () => {
    throw new Error("must not be reached");
  },
);
assert.doesNotThrow(() =>
  getterFailure({
    provider: "better-auth",
    subject: "subject",
    type: AUTH_SECURITY_EVENT_TYPES.PASSWORD_RESET_REQUESTED,
  }),
);

const schedulerFailure = createNonBlockingAuthSecurityAuditDispatcher(
  () => recorder,
  () => {
    throw new Error("scheduler detail");
  },
);
assert.doesNotThrow(() =>
  schedulerFailure({
    provider: "better-auth",
    subject: "subject",
    type: AUTH_SECURITY_EVENT_TYPES.MFA_TOTP_VERIFIED,
  }),
);

const signOutSource = await readFile(
  resolve("components/platform/auth/SignOutButton.tsx"),
  "utf8",
);
assert.match(signOutSource, /const result = await authClient\.signOut\(\)/);
assert.match(signOutSource, /if \(result\.error\)/);
assert.match(signOutSource, /Не удалось завершить сеанс\. Попробуйте ещё раз\./);
assert.match(signOutSource, /role="alert"/);
assert.match(signOutSource, /aria-busy=\{pending\}/);
assert.match(signOutSource, /min-h-11/);
assert.doesNotMatch(
  signOutSource,
  /finally\s*\{[\s\S]*router\.replace\("\/auth\/sign-in"\)/,
  "sign-out must not redirect from finally because a failed revocation can leave the server session active",
);
assert.match(
  signOutSource,
  /if \(result\.error\)[\s\S]*return;[\s\S]*router\.replace\("\/auth\/sign-in"\)/,
  "sign-out must redirect only after Better Auth reports success",
);

console.log("AUTH_SECURITY_AUDIT_TEST_PASS");

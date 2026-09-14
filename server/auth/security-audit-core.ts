export const AUTH_SECURITY_EVENT_TYPES = {
  SIGN_IN_SUCCESS: "auth.sign_in.success",
  MFA_TOTP_VERIFIED: "auth.mfa.totp_verified",
  MFA_BACKUP_CODE_USED: "auth.mfa.backup_code_used",
  PASSWORD_RESET_REQUESTED: "auth.password_reset.requested",
  PASSWORD_RESET_COMPLETED: "auth.password_reset.completed",
} as const;

export type AuthSecurityEventType =
  (typeof AUTH_SECURITY_EVENT_TYPES)[keyof typeof AUTH_SECURITY_EVENT_TYPES];

export type AuthSecurityAuditInput = {
  provider: string;
  subject: string;
  type: AuthSecurityEventType;
};

export interface AuthSecurityAuditRecorder {
  record(input: AuthSecurityAuditInput): Promise<boolean>;
}

export type AuthSecurityAuditBackgroundWork = () => Promise<void>;
export type AuthSecurityAuditBackgroundScheduler = (
  work: AuthSecurityAuditBackgroundWork,
) => void;

export function createNonBlockingAuthSecurityAuditDispatcher(
  getRecorder: () => AuthSecurityAuditRecorder,
  schedule: AuthSecurityAuditBackgroundScheduler,
) {
  return function dispatch(input: AuthSecurityAuditInput): void {
    try {
      const recorder = getRecorder();
      schedule(async () => {
        try {
          await recorder.record(input);
        } catch {
          // Authentication must not become retriable after Better Auth has
          // already changed session/recovery state. The event contains no PII,
          // and runtime code deliberately emits no raw error details here.
        }
      });
    } catch {
      // Audit configuration/scheduling state must not escape through auth responses.
    }
  };
}

export type BetterAuthHookIdentity = {
  subject: string | null;
  newSessionSubject: string | null;
};

function readSubject(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const user = (value as { user?: unknown }).user;
  if (!user || typeof user !== "object" || Array.isArray(user)) return null;
  const id = (user as { id?: unknown }).id;
  if (typeof id !== "string") return null;
  const normalized = id.trim();
  return normalized || null;
}

export function readBetterAuthHookIdentity(context: unknown): BetterAuthHookIdentity {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { subject: null, newSessionSubject: null };
  }

  const record = context as { newSession?: unknown; session?: unknown };
  const newSessionSubject = readSubject(record.newSession);
  return {
    newSessionSubject,
    subject: newSessionSubject ?? readSubject(record.session),
  };
}

export function classifyBetterAuthSecurityEvents(
  path: string,
  identity: BetterAuthHookIdentity,
): readonly AuthSecurityEventType[] {
  if (!identity.subject) return [];

  if (path === "/sign-in/email") {
    return identity.newSessionSubject
      ? [AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS]
      : [];
  }

  if (path === "/two-factor/verify-totp") {
    return identity.newSessionSubject
      ? [
          AUTH_SECURITY_EVENT_TYPES.MFA_TOTP_VERIFIED,
          AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS,
        ]
      : [AUTH_SECURITY_EVENT_TYPES.MFA_TOTP_VERIFIED];
  }

  if (path === "/two-factor/verify-backup-code") {
    return identity.newSessionSubject
      ? [
          AUTH_SECURITY_EVENT_TYPES.MFA_BACKUP_CODE_USED,
          AUTH_SECURITY_EVENT_TYPES.SIGN_IN_SUCCESS,
        ]
      : [AUTH_SECURITY_EVENT_TYPES.MFA_BACKUP_CODE_USED];
  }

  return [];
}

import "server-only";

import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { after } from "next/server";
import { Pool } from "pg";
import {
  readBetterAuthRuntimeConfig,
  readProductionDatabaseConfig,
} from "@/server/config/production";
import { createNonBlockingEmailDispatcher } from "@/server/email/background-dispatch";
import { getTransactionalEmailDelivery } from "@/server/email/runtime";
import { BETTER_AUTH_PROVIDER } from "@/server/auth/better-auth-session-reader";
import {
  AUTH_SECURITY_EVENT_TYPES,
  classifyBetterAuthSecurityEvents,
  createNonBlockingAuthSecurityAuditDispatcher,
  readBetterAuthHookIdentity,
} from "@/server/auth/security-audit-core";
import { getAuthSecurityAuditRecorder } from "@/server/auth/security-audit-runtime";

function assertTrustedAuthUrl(value: string, expectedOrigin: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("AUTH_EMAIL_INVALID_URL");
  }
  if (parsed.origin !== expectedOrigin) {
    throw new Error("AUTH_EMAIL_INVALID_URL");
  }
  return parsed.toString();
}

const dispatchAuthEmail = createNonBlockingEmailDispatcher(
  getTransactionalEmailDelivery,
  (work) => after(work),
);

const dispatchAuthSecurityEvent = createNonBlockingAuthSecurityAuditDispatcher(
  getAuthSecurityAuditRecorder,
  (work) => after(work),
);

function dispatchBetterAuthSecurityEvent(
  subject: string,
  type: (typeof AUTH_SECURITY_EVENT_TYPES)[keyof typeof AUTH_SECURITY_EVENT_TYPES],
) {
  const normalized = subject.trim();
  if (!normalized) return;
  dispatchAuthSecurityEvent({
    provider: BETTER_AUTH_PROVIDER,
    subject: normalized,
    type,
  });
}

function createBetterAuthInstance() {
  const database = readProductionDatabaseConfig();
  const runtime = readBetterAuthRuntimeConfig();
  const pool = new Pool({ connectionString: database.databaseUrl });

  return betterAuth({
    appName: "iБюро",
    secret: runtime.secret,
    baseURL: runtime.baseUrl,
    database: pool,
    account: {
      identityStrategy: "provider-id",
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const trustedUrl = assertTrustedAuthUrl(url, runtime.baseUrl);
        dispatchBetterAuthSecurityEvent(
          user.id,
          AUTH_SECURITY_EVENT_TYPES.PASSWORD_RESET_REQUESTED,
        );
        dispatchAuthEmail({
          to: user.email,
          subject: "Восстановление доступа к iБюро",
          text: [
            "Вы запросили восстановление доступа к iБюро.",
            "",
            "Чтобы задать новый пароль, откройте ссылку:",
            trustedUrl,
            "",
            "Если вы не запрашивали восстановление, просто проигнорируйте это письмо.",
          ].join("\n"),
        });
      },
      onPasswordReset: async ({ user }) => {
        dispatchBetterAuthSecurityEvent(
          user.id,
          AUTH_SECURITY_EVENT_TYPES.PASSWORD_RESET_COMPLETED,
        );
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const trustedUrl = assertTrustedAuthUrl(url, runtime.baseUrl);
        dispatchAuthEmail({
          to: user.email,
          subject: "Подтверждение электронной почты iБюро",
          text: [
            "Подтвердите адрес электронной почты для учётной записи iБюро.",
            "",
            "Откройте ссылку:",
            trustedUrl,
            "",
            "Если вы не ожидали это письмо, свяжитесь с iБюро через официальный канал поддержки.",
          ].join("\n"),
        });
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const identity = readBetterAuthHookIdentity(ctx.context);
        for (const type of classifyBetterAuthSecurityEvents(ctx.path, identity)) {
          if (!identity.subject) break;
          dispatchBetterAuthSecurityEvent(identity.subject, type);
        }
      }),
    },
    plugins: [
      twoFactor({
        issuer: "iБюро",
      }),
    ],
    advanced: {
      database: {
        joins: true,
      },
    },
  });
}

type BetterAuthInstance = ReturnType<typeof createBetterAuthInstance>;

let authInstance: BetterAuthInstance | undefined;

export function getBetterAuthInstance(): BetterAuthInstance {
  authInstance ??= createBetterAuthInstance();
  return authInstance;
}

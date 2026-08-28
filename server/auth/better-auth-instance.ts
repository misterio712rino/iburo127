import "server-only";

import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { after } from "next/server";
import { Pool } from "pg";
import {
  readBetterAuthRuntimeConfig,
  readProductionDatabaseConfig,
} from "@/server/config/production";
import { createNonBlockingEmailDispatcher } from "@/server/email/background-dispatch";
import { getTransactionalEmailDelivery } from "@/server/email/runtime";

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

function createBetterAuthInstance() {
  const database = readProductionDatabaseConfig();
  const runtime = readBetterAuthRuntimeConfig();
  const pool = new Pool({ connectionString: database.databaseUrl });

  return betterAuth({
    appName: "iБюро",
    secret: runtime.secret,
    baseURL: runtime.baseUrl,
    database: pool,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const trustedUrl = assertTrustedAuthUrl(url, runtime.baseUrl);
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

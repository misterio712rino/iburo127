import "server-only";

import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { Pool } from "pg";
import {
  readBetterAuthRuntimeConfig,
  readProductionDatabaseConfig,
} from "@/server/config/production";

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

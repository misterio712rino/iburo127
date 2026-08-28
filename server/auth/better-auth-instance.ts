import "server-only";

import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { Pool } from "pg";
import {
  readBetterAuthRuntimeConfig,
  readProductionDatabaseConfig,
} from "@/server/config/production";

let authInstance: ReturnType<typeof betterAuth> | undefined;
let authPool: Pool | undefined;

export function getBetterAuthInstance() {
  if (authInstance) return authInstance;

  const database = readProductionDatabaseConfig();
  const runtime = readBetterAuthRuntimeConfig();

  authPool = new Pool({ connectionString: database.databaseUrl });
  authInstance = betterAuth({
    appName: "iБюро",
    secret: runtime.secret,
    baseURL: runtime.baseUrl,
    database: authPool,
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

  return authInstance;
}

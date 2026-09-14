import "dotenv/config";

import { defineConfig } from "prisma-cli/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: [
      "public.user",
      "public.session",
      "public.account",
      "public.verification",
      "public.twoFactor",
      "public.rateLimit",
    ],
  },
});

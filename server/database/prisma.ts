import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readPostgresDatabaseUrl } from "@/server/database/database-url";

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

let prismaClient = globalForPrisma.prismaClient;

export function getPrismaClient(): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }

  const databaseUrl = readPostgresDatabaseUrl();
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  prismaClient = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaClient = prismaClient;
  }

  return prismaClient;
}

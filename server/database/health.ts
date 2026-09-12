import "server-only";

import { getPrismaClient } from "@/server/database/prisma";

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

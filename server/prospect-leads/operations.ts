import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireRole } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { getPrismaClient } from "@/server/database/prisma";

export async function listPotentialClientLeadsForManager(sessionProvider: SessionProvider) {
  const actor = await requireServerActor(sessionProvider);
  requireRole(actor, "MANAGER");

  return getPrismaClient().potentialClientLead.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 200,
  });
}

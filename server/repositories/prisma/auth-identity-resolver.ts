import "server-only";

import type {
  AuthIdentityResolver,
  ExternalAuthIdentity,
} from "@/server/auth/provider-boundary";
import { getPrismaClient } from "@/server/database/prisma";

export class PrismaAuthIdentityResolver implements AuthIdentityResolver {
  async resolveInternalUserId(identity: ExternalAuthIdentity): Promise<string | null> {
    const provider = identity.provider.trim();
    const subject = identity.subject.trim();
    if (!provider || !subject) return null;

    const prisma = getPrismaClient();
    const mapping = await prisma.authIdentity.findUnique({
      where: {
        provider_subject: { provider, subject },
      },
      select: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!mapping || mapping.user.status !== "ACTIVE") return null;
    return mapping.user.id;
  }
}

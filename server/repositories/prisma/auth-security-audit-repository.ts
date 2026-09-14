import "server-only";

import { BETTER_AUTH_PROVIDER } from "@/server/auth/better-auth-session-reader";
import type {
  AuthSecurityAuditInput,
  AuthSecurityAuditRecorder,
} from "@/server/auth/security-audit-core";
import { getPrismaClient } from "@/server/database/prisma";

export class PrismaAuthSecurityAuditRecorder implements AuthSecurityAuditRecorder {
  async record(input: AuthSecurityAuditInput): Promise<boolean> {
    const provider = input.provider.trim();
    const subject = input.subject.trim();
    if (!provider || !subject) return false;
    if (provider !== BETTER_AUTH_PROVIDER) return false;

    const prisma = getPrismaClient();
    const mapping = await prisma.authIdentity.findUnique({
      where: {
        provider_subject: { provider, subject },
      },
      select: { userId: true },
    });
    if (!mapping) return false;

    await prisma.userSecurityEvent.create({
      data: {
        userId: mapping.userId,
        type: input.type,
      },
      select: { id: true },
    });
    return true;
  }
}

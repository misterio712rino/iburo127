import "server-only";

import type { AuthSecurityAuditRecorder } from "@/server/auth/security-audit-core";
import { PrismaAuthSecurityAuditRecorder } from "@/server/repositories/prisma/auth-security-audit-repository";

let recorder: AuthSecurityAuditRecorder | undefined;

export function getAuthSecurityAuditRecorder(): AuthSecurityAuditRecorder {
  recorder ??= new PrismaAuthSecurityAuditRecorder();
  return recorder;
}

import "server-only";

import { AiAuditHealthService } from "@/server/ai/audit-health";
import { PrismaAiAuditHealthRepository } from "@/server/repositories/prisma/ai-audit-health-repository";

let service: AiAuditHealthService | undefined;

export function getAiAuditHealthService(): AiAuditHealthService {
  service ??= new AiAuditHealthService(new PrismaAiAuditHealthRepository());
  return service;
}

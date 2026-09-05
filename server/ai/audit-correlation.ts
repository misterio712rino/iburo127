import type { ActivityMetadata } from "@/server/domain/activity/contracts";

const AUDIT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertAiAuditId(value: string): string {
  const normalized = value.trim();
  if (!AUDIT_ID_PATTERN.test(normalized)) {
    throw new Error("AI_AUDIT_INVALID_ID");
  }
  return normalized.toLowerCase();
}

export function buildAiAuditMetadata(auditId: string): ActivityMetadata {
  return {
    schemaVersion: 1,
    auditId: assertAiAuditId(auditId),
  };
}

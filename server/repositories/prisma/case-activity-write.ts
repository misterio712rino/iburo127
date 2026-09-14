import "server-only";

import type { ActivityMetadata } from "@/server/domain/activity/contracts";
import {
  requireCaseActivityType,
  sanitizeActivityMetadata,
} from "@/server/domain/activity/taxonomy";

export function buildCaseActivityWrite(input: {
  clientCaseId: string;
  actorUserId: string | null;
  type: string;
  metadata?: ActivityMetadata;
}) {
  return {
    clientCaseId: input.clientCaseId,
    actorUserId: input.actorUserId,
    type: requireCaseActivityType(input.type),
    metadata: sanitizeActivityMetadata(input.metadata),
  };
}

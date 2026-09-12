import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { listCaseActivity } from "@/server/activity/operations";
import { parseActivityClientCaseId, parseActivityLimit } from "@/server/activity/input";
import { executeActivityOperation } from "@/server/activity/transport";

export function handleListCaseActivity(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
  limit?: unknown,
) {
  return executeActivityOperation(() =>
    listCaseActivity(
      sessionProvider,
      parseActivityClientCaseId(clientCaseId),
      parseActivityLimit(limit),
    ),
  );
}

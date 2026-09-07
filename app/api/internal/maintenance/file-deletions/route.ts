import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { getStoredFileDeletionWorker } from "@/server/files/deletion-worker-runtime";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const FILE_DELETION_BATCH_LIMIT = 1;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let config;
  try {
    config = readMaintenanceRuntimeConfig();
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_NOT_CONFIGURED" } }, 503);
  }

  if (!isAuthorizedMaintenanceRequest(request, config.secret)) {
    return json({ ok: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  try {
    const result = await getStoredFileDeletionWorker().runBatch({
      now: new Date(),
      limit: FILE_DELETION_BATCH_LIMIT,
    });
    const healthy =
      result.requiresAttention === 0 &&
      result.leaseLost === 0 &&
      result.finalizationDeferred === 0;
    return json(
      {
        ok: healthy,
        data: result,
        ...(healthy ? {} : { error: { code: "FILE_DELETION_ATTENTION_REQUIRED" } }),
      },
      healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "FILE_DELETION_UNAVAILABLE" } }, 503);
  }
}

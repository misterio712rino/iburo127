import { getPendingUploadCleanupService } from "@/server/files/pending-upload-cleanup-runtime";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";
import { readMaintenanceRuntimeConfig } from "@/server/config/production";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

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

  const before = new Date(Date.now() - config.staleUploadMaxAgeMinutes * 60_000);

  try {
    const result = await getPendingUploadCleanupService().cleanup({
      before,
      limit: config.staleUploadBatchLimit,
    });
    const healthy = result.failed === 0;
    return json(
      {
        ok: healthy,
        data: {
          inspected: result.inspected,
          deleted: result.deleted,
          skipped: result.skipped,
          failed: result.failed,
        },
        ...(healthy ? {} : { error: { code: "STORAGE_DELETE_RETRY_REQUIRED" } }),
      },
      healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

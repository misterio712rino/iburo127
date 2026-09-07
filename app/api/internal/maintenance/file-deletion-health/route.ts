import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { readStoredFileDeletionHealthConfig } from "@/server/files/deletion-health-config";
import { getStoredFileDeletionHealthService } from "@/server/files/deletion-health-runtime";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let maintenanceConfig;
  let healthConfig;
  try {
    maintenanceConfig = readMaintenanceRuntimeConfig();
    healthConfig = readStoredFileDeletionHealthConfig();
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_NOT_CONFIGURED" } }, 503);
  }

  if (!isAuthorizedMaintenanceRequest(request, maintenanceConfig.secret)) {
    return json({ ok: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  try {
    const result = await getStoredFileDeletionHealthService().inspect({
      now: new Date(),
      graceMinutes: healthConfig.graceMinutes,
      limit: healthConfig.batchLimit,
    });

    return json(
      {
        ok: result.healthy,
        data: {
          overduePending: result.overduePending,
          expiredLeases: result.expiredLeases,
          attentionRequired: result.attentionRequired,
          saturated: result.saturated,
          graceMinutes: result.graceMinutes,
          batchLimit: result.batchLimit,
        },
        ...(result.healthy
          ? {}
          : { error: { code: "FILE_DELETION_BACKLOG_UNHEALTHY" } }),
      },
      result.healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

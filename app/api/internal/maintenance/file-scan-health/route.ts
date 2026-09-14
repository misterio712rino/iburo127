import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { getStoredFileScanHealthService } from "@/server/files/scan-health-runtime";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";

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

  try {
    const result = await getStoredFileScanHealthService().inspect({
      now: new Date(),
      graceMinutes: config.fileScanHealthGraceMinutes,
      limit: config.fileScanHealthBatchLimit,
    });

    return json(
      {
        ok: result.healthy,
        data: {
          overduePending: result.overduePending,
          expiredLeases: result.expiredLeases,
          terminalFailures: result.terminalFailures,
          saturated: result.saturated,
          graceMinutes: result.graceMinutes,
          batchLimit: result.batchLimit,
        },
        ...(result.healthy ? {} : { error: { code: "FILE_SCAN_BACKLOG_UNHEALTHY" } }),
      },
      result.healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

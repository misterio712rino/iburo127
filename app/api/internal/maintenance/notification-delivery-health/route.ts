import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";
import { getNotificationDeliveryHealthService } from "@/server/notifications/delivery-health-runtime";

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
    const result = await getNotificationDeliveryHealthService().inspect({
      now: new Date(),
      graceMinutes: config.notificationDeliveryHealthGraceMinutes,
      limit: config.notificationDeliveryHealthBatchLimit,
    });

    return json(
      {
        ok: result.healthy,
        data: {
          overduePending: result.overduePending,
          expiredLeases: result.expiredLeases,
          dead: result.dead,
          saturated: result.saturated,
          graceMinutes: result.graceMinutes,
          batchLimit: result.batchLimit,
        },
        ...(result.healthy
          ? {}
          : { error: { code: "NOTIFICATION_DELIVERY_BACKLOG_UNHEALTHY" } }),
      },
      result.healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

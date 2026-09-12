import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";
import { getNotificationDeliveryWorker } from "@/server/notifications/delivery-runtime";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const DELIVERY_BATCH_LIMIT = 10;
const DELIVERY_LEASE_MS = 2 * 60_000;
const DELIVERY_MAX_ATTEMPTS = 6;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let maintenanceConfig;
  try {
    maintenanceConfig = readMaintenanceRuntimeConfig();
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_NOT_CONFIGURED" } }, 503);
  }

  if (!isAuthorizedMaintenanceRequest(request, maintenanceConfig.secret)) {
    return json({ ok: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  let worker;
  try {
    worker = getNotificationDeliveryWorker();
  } catch {
    return json(
      { ok: false, error: { code: "NOTIFICATION_DELIVERY_NOT_CONFIGURED" } },
      503,
    );
  }

  try {
    const result = await worker.processBatch({
      limit: DELIVERY_BATCH_LIMIT,
      leaseMs: DELIVERY_LEASE_MS,
      maxAttempts: DELIVERY_MAX_ATTEMPTS,
    });
    const healthy = result.retryScheduled === 0 && result.dead === 0 && result.leaseLost === 0;
    return json(
      {
        ok: healthy,
        data: result,
        ...(healthy ? {} : { error: { code: "NOTIFICATION_DELIVERY_RETRY_REQUIRED" } }),
      },
      healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { isAuthorizedMaintenanceRequest } from "@/server/maintenance/auth";
import { getTaskReminderWorker } from "@/server/tasks/reminder-runtime";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const TASK_REMINDER_BATCH_LIMIT = 50;

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

  try {
    const result = await getTaskReminderWorker().processBatch({
      limit: TASK_REMINDER_BATCH_LIMIT,
    });
    return json({ ok: true, data: result }, 200);
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

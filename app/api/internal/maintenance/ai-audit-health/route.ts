import { getAiAuditHealthService } from "@/server/ai/audit-health-runtime";
import { readMaintenanceRuntimeConfig } from "@/server/config/production";
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

  let service;
  try {
    service = getAiAuditHealthService();
  } catch {
    return json({ ok: false, error: { code: "AI_AUDIT_HEALTH_NOT_CONFIGURED" } }, 503);
  }

  try {
    const result = await service.check({
      now: new Date(),
      graceMinutes: config.aiAuditGraceMinutes,
      limit: config.aiAuditBatchLimit,
    });
    const healthy = result.orphanCount === 0;
    return json(
      {
        ok: healthy,
        data: result,
        ...(healthy ? {} : { error: { code: "AI_AUDIT_OUTCOME_MISSING" } }),
      },
      healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "MAINTENANCE_FAILED" } }, 500);
  }
}

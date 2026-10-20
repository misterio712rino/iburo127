import { readMaintenanceRuntimeConfig } from "@/server/config/production";
import { getDocumentProcessingWorker } from "@/server/files/document-processing-worker-runtime";
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
    const result = await getDocumentProcessingWorker().runBatch({
      now: new Date(),
      limit: config.documentProcessingBatchLimit,
    });
    const healthy = result.failed === 0 && result.leaseLost === 0;
    return json(
      {
        ok: healthy,
        data: result,
        ...(healthy ? {} : { error: { code: "DOCUMENT_PROCESSING_ATTENTION_REQUIRED" } }),
      },
      healthy ? 200 : 503,
    );
  } catch {
    return json({ ok: false, error: { code: "DOCUMENT_PROCESSING_UNAVAILABLE" } }, 503);
  }
}

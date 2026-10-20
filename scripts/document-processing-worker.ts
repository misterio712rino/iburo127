import { setTimeout as delay } from "node:timers/promises";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import { getDocumentProcessingWorker } from "@/server/files/document-processing-worker-runtime";

const POLL_INTERVAL_MS = 5_000;
let stopping = false;

process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

requireStagingDatabaseTarget();
const worker = getDocumentProcessingWorker();

while (!stopping) {
  try {
    const result = await worker.runBatch({ now: new Date(), limit: 1 });
    if (result.claimed === 0) {
      await delay(POLL_INTERVAL_MS);
      continue;
    }
    console.info(
      `DOCUMENT_PROCESSING_WORKER_BATCH claimed=${result.claimed} completed=${result.completed} cancelled=${result.cancelled} retried=${result.retried} failed=${result.failed} leaseLost=${result.leaseLost}`,
    );
  } catch {
    console.error("DOCUMENT_PROCESSING_WORKER_UNAVAILABLE");
    await delay(POLL_INTERVAL_MS);
  }
}

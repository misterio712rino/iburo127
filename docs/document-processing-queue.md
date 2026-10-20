# Document processing queue

OCR jobs are created in the same database transaction that marks a scanned file `READY`. The worker reads only `READY` files, checks case/file ownership, and persists page text under the job's case scope.

## Runtime

Run OCR in the dedicated Timeweb worker container, not through the web maintenance endpoint. The queue is durable in PostgreSQL; the worker polls one job at a time. During processing it renews the database lease every third of the configured lease period. If the worker stops, the lease expires and another worker can reclaim the job. All result writes remain fenced by the active lease token.

The processor accepts PDFs up to 40 pages. A scanned page can run three subprocesses, each bounded at 30 seconds (PDF text extraction, rasterization, and Tesseract), so one request can exceed web request limits. The processor client deadline is 65 minutes: 40 pages × 3 subprocesses × 30 seconds = 60 minutes, plus 5 minutes of response/overhead margin. The worker runs outside the HTTP request lifecycle.

The worker and processor have no published ports in the staging Compose file. The processor is reachable only on the Compose network. The worker requires the application database URL, the selected private storage credentials, and the processor bearer token. Store them in host-side files outside the repository:

- `/etc/iburo/document-processor.env`: `IB_DOCUMENT_PROCESSOR_TOKEN`.
- `/etc/iburo/document-processing-worker.env`: staging runtime identity and database guard variables from `.env.example` (`IB_DB_TARGET=staging`, database host/name/user and schema), staging database URL, `IB_OBJECT_STORAGE_PROVIDER=timeweb-object-storage`, Timeweb object-storage credentials, processor URL `http://document-processor:8080/`, and the same processor token. The worker validates the URL host, database name, and user against the staging guard variables before connecting.

The worker logs aggregate counters only. It does not log OCR text, filenames, object keys, or case/file IDs.

## Staging enablement

1. Apply the reviewed Prisma migrations to the intended staging database using the existing guarded migration workflow. Do not run migrations from either container.
2. Build and publish immutable web-worker and processor images, then set the image references in the host-side Compose environment.
3. Start the two staging services with `services/document-processor/deploy/docker-compose.timeweb.yml`. Confirm both containers are healthy and inspect only aggregate worker logs.
4. Send a synthetic PDF through the staging upload and scan flow. Confirm the OCR job reaches `COMPLETED` and page boundaries are preserved. Do not use a client document for this check.
5. Keep `IB_DOCUMENT_PROCESSING_SCHEDULER_ENABLED` unset/false. The web maintenance route is not the long-running OCR executor.

The scheduler workflow remains inert by default. The existing job queue does not return OCR text through maintenance responses. OCR text is internal source material; future fact extraction must create candidates for human review, and generated legal documents require lawyer review before delivery.

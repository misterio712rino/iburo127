# Document processing queue

The document OCR worker runs only after the malware scanner marks a stored file `READY`.
The READY transition and creation of the `DocumentProcessingJob` row share one database
transaction, so callers cannot observe a clean file without its OCR job.

## Processing lifecycle

Jobs move through `PENDING`, `PROCESSING`, and one terminal state: `COMPLETED`,
`FAILED`, or `CANCELLED`. Claims use a random lease token and a bounded lease. A
worker may reclaim an expired lease; all result and state writes require the active
token. Transient OCR errors use bounded exponential backoff.

A completed job stores OCR text as an ordered JSON array in `pageTexts`, preserving
page boundaries. The result is internal source material: it is not a court document,
is not sent to a client, and does not establish that any fact is absent. Any future
fact extraction must create candidates marked for human review. The maintenance
route returns aggregate counters only and never returns page text or file identifiers.

Deleting the source file cascades to its processing job and stored OCR text. The
composite foreign key also guarantees that the job's case ID matches its source file.

## Enabling the worker

Before enabling the GitHub Actions scheduler:

1. Apply all pending Prisma migrations to the intended environment. The staging
   baseline last inspected had 4 of the existing 10 migrations applied, so the
   earlier six migrations must be applied before this new migration.
2. Configure `IB_DOCUMENT_PROCESSOR_URL` and `IB_DOCUMENT_PROCESSOR_TOKEN` in the
   application runtime. The OCR service must be reachable from that runtime and must
   accept the private `POST /v1/extract` contract. The current URL guard allows only
   local/private/internal hosts; Vercel cannot call a Timeweb public hostname through
   this configuration. Provide private network connectivity or add a reviewed exact
   HTTPS host allowlist before connecting a public Timeweb endpoint.
3. Verify the document processor's authenticated health and a synthetic PDF against
   staging, without processing client documents.
4. Enable the repository variable `IB_DOCUMENT_PROCESSING_SCHEDULER_ENABLED=true`
   only after the staging verification is complete. The scheduler remains disabled
   unless this explicit variable is set and runs only from the default branch.

The checked-in scheduler is inert by default. No database migration or OCR processing
is performed by CI. Do not enable the production scheduler until staging verification
and the production migration plan have been reviewed.

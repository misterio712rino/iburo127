BEGIN;

CREATE TYPE "DocumentProcessingStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "DocumentProcessingJob" (
  "id" UUID NOT NULL,
  "clientCaseId" UUID NOT NULL,
  "sourceFileId" UUID NOT NULL,
  "status" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "leaseToken" UUID,
  "lastErrorCode" TEXT,
  "pageTexts" JSONB,
  "pageCount" INTEGER,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentProcessingJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentProcessingJob_attemptCount_check" CHECK ("attemptCount" >= 0),
  CONSTRAINT "DocumentProcessingJob_pageCount_check" CHECK ("pageCount" IS NULL OR ("pageCount" BETWEEN 1 AND 40)),
  CONSTRAINT "DocumentProcessingJob_lease_check" CHECK (
    ("status" = 'PROCESSING' AND "leaseUntil" IS NOT NULL AND "leaseToken" IS NOT NULL)
    OR ("status" <> 'PROCESSING' AND "leaseUntil" IS NULL AND "leaseToken" IS NULL)
  ),
  CONSTRAINT "DocumentProcessingJob_completion_check" CHECK (
    ("status" = 'COMPLETED' AND jsonb_typeof("pageTexts") = 'array' AND "pageCount" IS NOT NULL AND "completedAt" IS NOT NULL)
    OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL)
  ),
  CONSTRAINT "DocumentProcessingJob_failure_check" CHECK (
    ("status" = 'FAILED' AND "failedAt" IS NOT NULL)
    OR ("status" <> 'FAILED' AND "failedAt" IS NULL)
  ),
  CONSTRAINT "DocumentProcessingJob_cancellation_check" CHECK (
    ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL)
    OR ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "StoredFile_id_clientCaseId_key"
  ON "StoredFile"("id", "clientCaseId");
CREATE UNIQUE INDEX "DocumentProcessingJob_sourceFileId_clientCaseId_key"
  ON "DocumentProcessingJob"("sourceFileId", "clientCaseId");
CREATE INDEX "DocumentProcessingJob_status_nextAttemptAt_idx"
  ON "DocumentProcessingJob"("status", "nextAttemptAt");
CREATE INDEX "DocumentProcessingJob_status_leaseUntil_idx"
  ON "DocumentProcessingJob"("status", "leaseUntil");
CREATE INDEX "DocumentProcessingJob_clientCaseId_createdAt_idx"
  ON "DocumentProcessingJob"("clientCaseId", "createdAt");

ALTER TABLE "DocumentProcessingJob"
  ADD CONSTRAINT "DocumentProcessingJob_sourceFileId_clientCaseId_fkey"
  FOREIGN KEY ("sourceFileId", "clientCaseId")
  REFERENCES "StoredFile"("id", "clientCaseId")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

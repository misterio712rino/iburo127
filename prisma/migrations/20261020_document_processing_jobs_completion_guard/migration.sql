BEGIN;

ALTER TABLE "DocumentProcessingJob"
  DROP CONSTRAINT "DocumentProcessingJob_completion_check";

ALTER TABLE "DocumentProcessingJob"
  ADD CONSTRAINT "DocumentProcessingJob_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "pageTexts" IS NOT NULL AND jsonb_typeof("pageTexts") = 'array' AND "pageCount" IS NOT NULL AND "completedAt" IS NOT NULL)
    OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL)
  );

COMMIT;

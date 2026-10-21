CREATE TYPE "ExtractedFactReviewStatus" AS ENUM (
  'NEEDS_REVIEW',
  'CONFIRMED',
  'REJECTED'
);

CREATE TABLE "ExtractedFactCandidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clientCaseId" UUID NOT NULL,
  "sourceFileId" UUID NOT NULL,
  "fieldPath" VARCHAR(200) NOT NULL,
  "recordKey" VARCHAR(80) NOT NULL DEFAULT 'default',
  "sourcePage" INTEGER NOT NULL,
  "value" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "reviewStatus" "ExtractedFactReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExtractedFactCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtractedFactCandidate_sourcePage_check" CHECK ("sourcePage" BETWEEN 1 AND 40),
  CONSTRAINT "ExtractedFactCandidate_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1),
  CONSTRAINT "ExtractedFactCandidate_review_check" CHECK (
    ("reviewStatus" = 'NEEDS_REVIEW' AND "reviewedAt" IS NULL AND "reviewedById" IS NULL)
    OR ("reviewStatus" IN ('CONFIRMED', 'REJECTED') AND "reviewedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ExtractedFactCandidate_sourceFileId_clientCaseId_recordKey_fieldPath_sourcePage_key"
  ON "ExtractedFactCandidate"("sourceFileId", "clientCaseId", "recordKey", "fieldPath", "sourcePage");
CREATE INDEX "ExtractedFactCandidate_clientCaseId_reviewStatus_createdAt_idx"
  ON "ExtractedFactCandidate"("clientCaseId", "reviewStatus", "createdAt");
CREATE INDEX "ExtractedFactCandidate_reviewedById_reviewedAt_idx"
  ON "ExtractedFactCandidate"("reviewedById", "reviewedAt");

ALTER TABLE "ExtractedFactCandidate"
  ADD CONSTRAINT "ExtractedFactCandidate_sourceFileId_clientCaseId_fkey"
  FOREIGN KEY ("sourceFileId", "clientCaseId")
  REFERENCES "StoredFile"("id", "clientCaseId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedFactCandidate"
  ADD CONSTRAINT "ExtractedFactCandidate_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

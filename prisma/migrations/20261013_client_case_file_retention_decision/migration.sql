BEGIN;

-- CreateEnum
CREATE TYPE "ClientCaseFileRetentionChoice" AS ENUM (
  'DELETE_NOW',
  'KEEP_UNTIL_AUTOMATIC_DELETION'
);

CREATE TYPE "ClientCaseFileRetentionStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'REQUIRES_ATTENTION'
);

-- CreateTable
CREATE TABLE "ClientCaseFileRetentionDecision" (
  "clientCaseId" UUID NOT NULL,
  "requestedByUserId" UUID NOT NULL,
  "choice" "ClientCaseFileRetentionChoice" NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "procedureCompletedAt" TIMESTAMP(3) NOT NULL,
  "deleteAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL,
  "status" "ClientCaseFileRetentionStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "leaseToken" UUID,
  "lastErrorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientCaseFileRetentionDecision_pkey" PRIMARY KEY ("clientCaseId")
);

-- CreateIndex
CREATE INDEX "ClientCaseFileRetentionDecision_choice_deleteAt_idx"
  ON "ClientCaseFileRetentionDecision"("choice", "deleteAt");

CREATE INDEX "ClientCaseFileRetentionDecision_status_nextAttemptAt_deleteAt_idx"
  ON "ClientCaseFileRetentionDecision"("status", "nextAttemptAt", "deleteAt");

CREATE INDEX "ClientCaseFileRetentionDecision_status_leaseUntil_idx"
  ON "ClientCaseFileRetentionDecision"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "ClientCaseFileRetentionDecision_requestedByUserId_decidedAt_idx"
  ON "ClientCaseFileRetentionDecision"("requestedByUserId", "decidedAt");

-- AddForeignKey
ALTER TABLE "ClientCaseFileRetentionDecision"
  ADD CONSTRAINT "ClientCaseFileRetentionDecision_clientCaseId_fkey"
  FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCaseFileRetentionDecision"
  ADD CONSTRAINT "ClientCaseFileRetentionDecision_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

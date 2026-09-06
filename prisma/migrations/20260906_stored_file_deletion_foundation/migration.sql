-- CreateEnum
CREATE TYPE "StoredFileDeletionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REQUIRES_ATTENTION');

-- CreateTable
CREATE TABLE "StoredFileDeletion" (
    "fileId" UUID NOT NULL,
    "clientCaseId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileStatus" "StoredFileStatus" NOT NULL,
    "status" "StoredFileDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" UUID,
    "lastErrorCode" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionActivityEventId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredFileDeletion_pkey" PRIMARY KEY ("fileId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFileDeletion_completionActivityEventId_key" ON "StoredFileDeletion"("completionActivityEventId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFileDeletion_storageProvider_objectKey_key" ON "StoredFileDeletion"("storageProvider", "objectKey");

-- CreateIndex
CREATE INDEX "StoredFileDeletion_status_nextAttemptAt_idx" ON "StoredFileDeletion"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "StoredFileDeletion_status_leaseUntil_idx" ON "StoredFileDeletion"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "StoredFileDeletion_clientCaseId_requestedAt_idx" ON "StoredFileDeletion"("clientCaseId", "requestedAt");

-- CreateIndex
CREATE INDEX "StoredFileDeletion_requestedByUserId_requestedAt_idx" ON "StoredFileDeletion"("requestedByUserId", "requestedAt");

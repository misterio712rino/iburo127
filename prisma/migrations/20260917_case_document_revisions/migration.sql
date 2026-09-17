-- CreateEnum
CREATE TYPE "CaseDocumentRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "CaseDocumentRevision" (
    "id" UUID NOT NULL,
    "caseDocumentId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templateSourceHash" TEXT NOT NULL,
    "questionnaireVersion" INTEGER NOT NULL,
    "sourceDataHash" TEXT NOT NULL,
    "sourceData" JSONB NOT NULL,
    "status" "CaseDocumentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "submittedByUserId" UUID,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseDocumentRevision_caseDocumentId_revisionNumber_key" ON "CaseDocumentRevision"("caseDocumentId", "revisionNumber");

-- CreateIndex
CREATE INDEX "CaseDocumentRevision_caseDocumentId_status_createdAt_idx" ON "CaseDocumentRevision"("caseDocumentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CaseDocumentRevision_createdByUserId_createdAt_idx" ON "CaseDocumentRevision"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseDocumentRevision_submittedByUserId_submittedAt_idx" ON "CaseDocumentRevision"("submittedByUserId", "submittedAt");

-- CreateIndex
CREATE INDEX "CaseDocumentRevision_reviewedByUserId_reviewedAt_idx" ON "CaseDocumentRevision"("reviewedByUserId", "reviewedAt");

-- AddForeignKey
ALTER TABLE "CaseDocumentRevision" ADD CONSTRAINT "CaseDocumentRevision_caseDocumentId_fkey" FOREIGN KEY ("caseDocumentId") REFERENCES "CaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocumentRevision" ADD CONSTRAINT "CaseDocumentRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocumentRevision" ADD CONSTRAINT "CaseDocumentRevision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocumentRevision" ADD CONSTRAINT "CaseDocumentRevision_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

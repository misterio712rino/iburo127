-- CreateEnum
CREATE TYPE "PracticumHomeworkStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "PracticumHomeworkReviewDecision" AS ENUM ('CHANGES_REQUESTED', 'ACCEPTED');

-- CreateTable
CREATE TABLE "CasePracticumHomework" (
    "id" UUID NOT NULL,
    "clientCaseId" UUID NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "PracticumHomeworkStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "draftText" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasePracticumHomework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePracticumHomeworkRevision" (
    "id" UUID NOT NULL,
    "homeworkId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "answerText" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" UUID,
    "reviewDecision" "PracticumHomeworkReviewDecision",
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "CasePracticumHomeworkRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePracticumLessonMessage" (
    "id" UUID NOT NULL,
    "clientCaseId" UUID NOT NULL,
    "lessonId" TEXT NOT NULL,
    "authorUserId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasePracticumLessonMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePracticumLessonReadState" (
    "clientCaseId" UUID NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasePracticumLessonReadState_pkey" PRIMARY KEY ("clientCaseId", "lessonId", "userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CasePracticumHomework_clientCaseId_lessonId_key" ON "CasePracticumHomework"("clientCaseId", "lessonId");
CREATE INDEX "CasePracticumHomework_clientCaseId_status_updatedAt_idx" ON "CasePracticumHomework"("clientCaseId", "status", "updatedAt");
CREATE INDEX "CasePracticumHomework_status_submittedAt_idx" ON "CasePracticumHomework"("status", "submittedAt");
CREATE UNIQUE INDEX "CasePracticumHomeworkRevision_homeworkId_revisionNumber_key" ON "CasePracticumHomeworkRevision"("homeworkId", "revisionNumber");
CREATE INDEX "CasePracticumHomeworkRevision_homeworkId_submittedAt_idx" ON "CasePracticumHomeworkRevision"("homeworkId", "submittedAt");
CREATE INDEX "CasePracticumHomeworkRevision_submittedByUserId_idx" ON "CasePracticumHomeworkRevision"("submittedByUserId");
CREATE INDEX "CasePracticumHomeworkRevision_reviewedByUserId_reviewedAt_idx" ON "CasePracticumHomeworkRevision"("reviewedByUserId", "reviewedAt");
CREATE INDEX "CasePracticumLessonMessage_clientCaseId_lessonId_createdAt_idx" ON "CasePracticumLessonMessage"("clientCaseId", "lessonId", "createdAt");
CREATE INDEX "CasePracticumLessonMessage_authorUserId_createdAt_idx" ON "CasePracticumLessonMessage"("authorUserId", "createdAt");
CREATE INDEX "CasePracticumLessonReadState_userId_lastReadAt_idx" ON "CasePracticumLessonReadState"("userId", "lastReadAt");

-- AddForeignKey
ALTER TABLE "CasePracticumHomework" ADD CONSTRAINT "CasePracticumHomework_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasePracticumHomeworkRevision" ADD CONSTRAINT "CasePracticumHomeworkRevision_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "CasePracticumHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasePracticumHomeworkRevision" ADD CONSTRAINT "CasePracticumHomeworkRevision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CasePracticumHomeworkRevision" ADD CONSTRAINT "CasePracticumHomeworkRevision_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CasePracticumLessonMessage" ADD CONSTRAINT "CasePracticumLessonMessage_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasePracticumLessonMessage" ADD CONSTRAINT "CasePracticumLessonMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CasePracticumLessonReadState" ADD CONSTRAINT "CasePracticumLessonReadState_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasePracticumLessonReadState" ADD CONSTRAINT "CasePracticumLessonReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

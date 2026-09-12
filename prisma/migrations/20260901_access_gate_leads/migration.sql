CREATE TYPE "PotentialClientLeadContactType" AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE "PotentialClientLeadStatus" AS ENUM ('NEW', 'CONVERTED', 'ARCHIVED');

CREATE TABLE "PotentialClientLead" (
    "id" UUID NOT NULL,
    "contactType" "PotentialClientLeadContactType" NOT NULL,
    "contactKey" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AUTH_GATE',
    "status" "PotentialClientLeadStatus" NOT NULL DEFAULT 'NEW',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PotentialClientLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PotentialClientLead_contactKey_key" ON "PotentialClientLead"("contactKey");
CREATE INDEX "PotentialClientLead_status_lastSeenAt_idx" ON "PotentialClientLead"("status", "lastSeenAt");
CREATE INDEX "PotentialClientLead_contactType_lastSeenAt_idx" ON "PotentialClientLead"("contactType", "lastSeenAt");

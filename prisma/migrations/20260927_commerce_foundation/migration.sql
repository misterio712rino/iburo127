BEGIN;

-- CreateEnum
CREATE TYPE "CommerceOrderStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CANCELLED',
  'PAID',
  'PROVISIONING',
  'PROVISIONED',
  'REFUNDED',
  'CHARGEBACK'
);

-- CreateEnum
CREATE TYPE "CommercePaymentStatus" AS ENUM (
  'PENDING',
  'FAILED',
  'CANCELLED',
  'SUCCEEDED',
  'REFUNDED',
  'CHARGEBACK'
);

-- CreateEnum
CREATE TYPE "CommercePaymentEventKind" AS ENUM (
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'CHARGEBACK'
);

-- CreateEnum
CREATE TYPE "CommercePaymentEventProcessingStatus" AS ENUM (
  'RECEIVED',
  'APPLIED',
  'IGNORED',
  'REJECTED'
);

-- CreateTable
CREATE TABLE "CommerceOrder" (
    "id" UUID NOT NULL,
    "publicCheckoutId" TEXT NOT NULL,
    "planId" UUID NOT NULL,
    "userId" UUID,
    "clientCaseId" UUID,
    "customerEmail" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "offerVersion" TEXT NOT NULL,
    "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidAt" TIMESTAMP(3),
    "provisionedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommerceOrder_amountMinor_check" CHECK ("amountMinor" > 0 AND "amountMinor" <= 2000000000),
    CONSTRAINT "CommerceOrder_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateTable
CREATE TABLE "CommercePayment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommercePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerOccurredAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercePayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercePayment_amountMinor_check" CHECK ("amountMinor" > 0 AND "amountMinor" <= 2000000000),
    CONSTRAINT "CommercePayment_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateTable
CREATE TABLE "CommercePaymentEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "kind" "CommercePaymentEventKind" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "providerOccurredAt" TIMESTAMP(3) NOT NULL,
    "rawBodySha256" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "processingStatus" "CommercePaymentEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "rejectionCode" TEXT,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercePaymentEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommercePaymentEvent_amountMinor_check" CHECK ("amountMinor" > 0 AND "amountMinor" <= 2000000000),
    CONSTRAINT "CommercePaymentEvent_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "CommercePaymentEvent_rawBodySha256_check" CHECK ("rawBodySha256" ~ '^[0-9a-f]{64}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "CommerceOrder_publicCheckoutId_key" ON "CommerceOrder"("publicCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceOrder_clientCaseId_key" ON "CommerceOrder"("clientCaseId");

-- CreateIndex
CREATE INDEX "CommerceOrder_planId_status_createdAt_idx" ON "CommerceOrder"("planId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommerceOrder_userId_status_createdAt_idx" ON "CommerceOrder"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommerceOrder_status_createdAt_idx" ON "CommerceOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePayment_provider_providerPaymentId_key" ON "CommercePayment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "CommercePayment_orderId_status_createdAt_idx" ON "CommercePayment"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommercePayment_provider_status_providerOccurredAt_idx" ON "CommercePayment"("provider", "status", "providerOccurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePaymentEvent_provider_providerEventId_key" ON "CommercePaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "CommercePaymentEvent_orderId_receivedAt_idx" ON "CommercePaymentEvent"("orderId", "receivedAt");

-- CreateIndex
CREATE INDEX "CommercePaymentEvent_paymentId_receivedAt_idx" ON "CommercePaymentEvent"("paymentId", "receivedAt");

-- CreateIndex
CREATE INDEX "CommercePaymentEvent_provider_providerPaymentId_providerOccurredAt_idx" ON "CommercePaymentEvent"("provider", "providerPaymentId", "providerOccurredAt");

-- CreateIndex
CREATE INDEX "CommercePaymentEvent_processingStatus_receivedAt_idx" ON "CommercePaymentEvent"("processingStatus", "receivedAt");

-- AddForeignKey
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePaymentEvent" ADD CONSTRAINT "CommercePaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePaymentEvent" ADD CONSTRAINT "CommercePaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

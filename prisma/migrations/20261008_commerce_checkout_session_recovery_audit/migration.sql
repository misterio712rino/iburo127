BEGIN;

CREATE TABLE "CommerceCheckoutSessionRecovery" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "operatorUserId" UUID NOT NULL,
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommerceCheckoutSessionRecovery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceCheckoutSessionRecovery_orderId_key"
  ON "CommerceCheckoutSessionRecovery"("orderId");
CREATE UNIQUE INDEX "CommerceCheckoutSessionRecovery_stripeCheckoutSessionId_key"
  ON "CommerceCheckoutSessionRecovery"("stripeCheckoutSessionId");
CREATE INDEX "CommerceCheckoutSessionRecovery_operatorUserId_createdAt_idx"
  ON "CommerceCheckoutSessionRecovery"("operatorUserId", "createdAt");

ALTER TABLE "CommerceCheckoutSessionRecovery"
  ADD CONSTRAINT "CommerceCheckoutSessionRecovery_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommerceCheckoutSessionRecovery"
  ADD CONSTRAINT "CommerceCheckoutSessionRecovery_operatorUserId_fkey"
  FOREIGN KEY ("operatorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

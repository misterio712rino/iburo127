ALTER TABLE "CommerceOrder"
ADD COLUMN "checkoutRequestId" UUID;

CREATE UNIQUE INDEX "CommerceOrder_checkoutRequestId_key"
ON "CommerceOrder"("checkoutRequestId");

BEGIN;

ALTER TABLE "CommerceOrder"
  ADD COLUMN "stripeCheckoutSessionCreateStartedAt" TIMESTAMP(3);

COMMIT;

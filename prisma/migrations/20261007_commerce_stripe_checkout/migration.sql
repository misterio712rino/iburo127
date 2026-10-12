BEGIN;

ALTER TABLE "CommerceOrder"
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "previousPlanId" UUID;

DROP INDEX IF EXISTS "CommerceOrder_clientCaseId_key";
CREATE INDEX IF NOT EXISTS "CommerceOrder_clientCaseId_idx"
  ON "CommerceOrder" ("clientCaseId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CommerceOrder"
    WHERE "clientCaseId" IS NOT NULL
      AND "status" = 'PENDING_PAYMENT'
    GROUP BY "clientCaseId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'COMMERCE_PENDING_CASE_ORDER_DUPLICATE';
  END IF;
END $$;

CREATE UNIQUE INDEX "CommerceOrder_one_pending_per_case_key"
  ON "CommerceOrder" ("clientCaseId")
  WHERE "clientCaseId" IS NOT NULL
    AND "status" = 'PENDING_PAYMENT';

CREATE UNIQUE INDEX "CommerceOrder_stripeCheckoutSessionId_key"
  ON "CommerceOrder" ("stripeCheckoutSessionId");

UPDATE "CommerceOrder" AS orders
SET "previousPlanId" = cases."planId"
FROM "ClientCase" AS cases
WHERE orders."clientCaseId" = cases."id"
  AND orders."previousPlanId" IS NULL
  AND orders."status" = 'PENDING_PAYMENT';

ALTER TABLE "CommerceOrder"
  ADD CONSTRAINT "CommerceOrder_previousPlanId_fkey"
  FOREIGN KEY ("previousPlanId") REFERENCES "Plan" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

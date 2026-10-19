# Stripe commerce migration: read-only preflight

This script is for a separately approved staging database only. It is read-only and does not apply migrations.
Run it only after confirming the target database and comparing the migration history with an approved fingerprint.

```sql
BEGIN TRANSACTION READ ONLY;

-- 1. Show the current database and schema.
SELECT current_database() AS database_name, current_schema() AS schema_name;

-- 2. The migration creates one pending order per case. Any returned row must be reviewed.
SELECT "clientCaseId", COUNT(*) AS pending_order_count
FROM "CommerceOrder"
WHERE "clientCaseId" IS NOT NULL
  AND "status" = 'PENDING_PAYMENT'
GROUP BY "clientCaseId"
HAVING COUNT(*) > 1;

-- 3. Only pending orders receive previousPlanId, using the case plan at migration time.
-- Confirm each pending order is still associated with the intended case and target plan.
-- Completed historical orders keep previousPlanId = NULL because their prior plan is unknown.
SELECT o."id", o."publicCheckoutId", o."status",
       o."planId" AS order_target_plan_id, c."planId" AS inferred_previous_plan_id
FROM "CommerceOrder" AS o
JOIN "ClientCase" AS c ON c."id" = o."clientCaseId"
WHERE o."clientCaseId" IS NOT NULL
  AND o."status" = 'PENDING_PAYMENT'
ORDER BY o."createdAt", o."id";

-- 4. Verify case and plan references before relying on the backfill.
-- Foreign keys should make both result sets empty; non-empty results mean schema drift.
SELECT o."id", o."clientCaseId"
FROM "CommerceOrder" AS o
LEFT JOIN "ClientCase" AS c ON c."id" = o."clientCaseId"
WHERE o."clientCaseId" IS NOT NULL AND c."id" IS NULL;

SELECT o."id", o."planId"
FROM "CommerceOrder" AS o
LEFT JOIN "Plan" AS p ON p."id" = o."planId"
WHERE p."id" IS NULL;

-- 5. Capture the applied migration names/checksums for comparison with the approved pin.
-- Do not treat an unapproved result as a valid baseline.
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at, migration_name;

ROLLBACK;
```

Before applying `20261007_commerce_stripe_checkout`, require:
- no duplicate pending case orders;
- no orphan references;
- review pending case orders to confirm the case plan is the correct pre-payment plan;
- keep `previousPlanId` NULL for non-pending historical orders because their prior plan cannot be inferred;
- migration history matching the approved staging fingerprint.

No database was contacted while preparing these queries.

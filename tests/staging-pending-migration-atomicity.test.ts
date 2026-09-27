import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pendingMigrations = [
  "prisma/migrations/20260917_case_document_revisions/migration.sql",
  "prisma/migrations/20260927_commerce_foundation/migration.sql",
  "prisma/migrations/20260927_commerce_order_checkout_idempotency/migration.sql",
];

for (const relativePath of pendingMigrations) {
  const sql = readFileSync(resolve(process.cwd(), relativePath), "utf8").trim();

  assert.match(sql, /^BEGIN;\s*/);
  assert.match(sql, /\sCOMMIT;$/);
  assert.equal((sql.match(/\bBEGIN;/g) ?? []).length, 1);
  assert.equal((sql.match(/\bCOMMIT;/g) ?? []).length, 1);

  for (const forbidden of [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i,
  ]) {
    assert.doesNotMatch(sql, forbidden);
  }
}

console.log("STAGING_PENDING_MIGRATION_ATOMICITY_PASS");

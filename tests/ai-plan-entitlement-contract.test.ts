import assert from "node:assert/strict";
import { STAGING_PLAN_FEATURE_CODES } from "@/server/staging/domain-fixtures";

for (const planCode of ["LITE", "PRO", "INDIVIDUAL"] as const) {
  assert.ok(
    STAGING_PLAN_FEATURE_CODES[planCode].includes("AI_ASSISTANT"),
    `${planCode} must include AI_ASSISTANT`,
  );
}

assert.equal(
  STAGING_PLAN_FEATURE_CODES.LITE.includes("MORTGAGE_ANALYSIS"),
  false,
  "LITE must keep mortgage analysis separate from the all-plan AI entitlement",
);
assert.ok(
  STAGING_PLAN_FEATURE_CODES.PRO.includes("MORTGAGE_ANALYSIS"),
  "PRO must retain mortgage analysis",
);
assert.ok(
  STAGING_PLAN_FEATURE_CODES.INDIVIDUAL.includes("MORTGAGE_ANALYSIS"),
  "INDIVIDUAL must retain mortgage analysis",
);

console.log("AI_PLAN_ENTITLEMENT_CONTRACT_PASS");

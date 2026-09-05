import assert from "node:assert/strict";
import { STAGING_PLAN_FEATURE_CODES } from "@/server/staging/domain-fixtures";

function hasFeature(codes: readonly string[], featureCode: string) {
  return codes.includes(featureCode);
}

for (const planCode of ["LITE", "PRO", "INDIVIDUAL"] as const) {
  assert.ok(
    hasFeature(STAGING_PLAN_FEATURE_CODES[planCode], "AI_ASSISTANT"),
    `${planCode} must include AI_ASSISTANT`,
  );
}

assert.equal(
  hasFeature(STAGING_PLAN_FEATURE_CODES.LITE, "MORTGAGE_ANALYSIS"),
  false,
  "LITE must keep mortgage analysis separate from the all-plan AI entitlement",
);
assert.ok(
  hasFeature(STAGING_PLAN_FEATURE_CODES.PRO, "MORTGAGE_ANALYSIS"),
  "PRO must retain mortgage analysis",
);
assert.ok(
  hasFeature(STAGING_PLAN_FEATURE_CODES.INDIVIDUAL, "MORTGAGE_ANALYSIS"),
  "INDIVIDUAL must retain mortgage analysis",
);

console.log("AI_PLAN_ENTITLEMENT_CONTRACT_PASS");

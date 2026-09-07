import assert from "node:assert/strict";
import type { AiCaseContext } from "@/server/domain/ai/contracts";
import {
  AI_POLICY_BOUNDARY_REPLY,
  buildAiInstructions,
} from "@/server/domain/ai/policy";
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

const baseContext = {
  stageCode: "QUESTIONNAIRE",
  caseStatus: "ACTIVE",
  questionnaireStatus: "IN_PROGRESS",
  questionnaireCompletedSections: 1,
  practicumStatus: "IN_PROGRESS",
  practicumCompletedLessons: 1,
  documents: [],
  taskSummary: { newCount: 0, workingCount: 0, doneCount: 0, overdueCount: 0 },
  readyFileCount: 0,
  featureCodes: ["AI_ASSISTANT"],
} satisfies Omit<AiCaseContext, "planCode">;

const liteInstructions = buildAiInstructions({ ...baseContext, planCode: "LITE" });
assert.doesNotMatch(
  liteInstructions,
  /обсудить конкретный выбор с сопровождающим юристом/i,
  "LITE AI instructions must not imply bundled lawyer support",
);
assert.match(liteInstructions, /отдельн(?:ую|ой) консультац/i);
assert.match(liteInstructions, /не создавай впечатление/i);
assert.match(liteInstructions, /персональный или сопровождающий юрист входит в тариф LITE/i);

for (const planCode of ["PRO", "INDIVIDUAL"] as const) {
  const instructions = buildAiInstructions({ ...baseContext, planCode });
  assert.match(
    instructions,
    /обсудить конкретный выбор с сопровождающим юристом/i,
    `${planCode} may reference included human support`,
  );
}

assert.doesNotMatch(
  AI_POLICY_BOUNDARY_REPLY,
  /сопровождающ(?:ий|его|им) юрист/i,
  "shared AI safety fallback must remain plan-neutral",
);
assert.match(AI_POLICY_BOUNDARY_REPLY, /отдельной консультации с квалифицированным юристом/i);

console.log("AI_PLAN_ENTITLEMENT_CONTRACT_PASS");

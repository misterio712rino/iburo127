import assert from "node:assert/strict";
import {
  BITRIX24_CASE_FIELD_MAP_INVALID,
  BITRIX24_CASE_PROJECTION_INVALID,
  buildBitrix24CaseProjection,
  mapBitrix24CaseProjection,
  parseBitrix24CaseFieldMap,
} from "@/server/integrations/bitrix24/case-projection";

const sourceWithSensitiveFields = {
  caseNumber: "IB-2026-00042",
  planCode: "PRO",
  stageCode: "DOCUMENTS",
  status: "ACTIVE" as const,
  clientId: "client-user-uuid-must-not-export",
  assignedLawyerId: "lawyer-user-uuid-must-not-export",
  displayName: "Sensitive Name Must Not Export",
  email: "private@example.com",
  phone: "+70000000000",
  questionnaireAnswers: { passport: "must-not-export" },
  fileName: "passport.pdf",
};

const projection = buildBitrix24CaseProjection(sourceWithSensitiveFields);
assert.deepEqual(projection, {
  caseNumber: "IB-2026-00042",
  planCode: "PRO",
  stageCode: "DOCUMENTS",
  status: "ACTIVE",
});
assert.equal("clientId" in projection, false);
assert.equal("assignedLawyerId" in projection, false);
assert.equal("displayName" in projection, false);
assert.equal("email" in projection, false);
assert.equal("phone" in projection, false);
assert.equal("questionnaireAnswers" in projection, false);
assert.equal("fileName" in projection, false);

const fieldMap = parseBitrix24CaseFieldMap(
  "caseNumber=title,planCode=ufCrm128PlanCode,stageCode=ufCrm128StageCode,status=ufCrm128CaseStatus",
);
assert.deepEqual(fieldMap, {
  caseNumber: "title",
  planCode: "ufCrm128PlanCode",
  stageCode: "ufCrm128StageCode",
  status: "ufCrm128CaseStatus",
});

const payload = mapBitrix24CaseProjection(projection, fieldMap);
assert.deepEqual(payload, {
  title: "IB-2026-00042",
  ufCrm128PlanCode: "PRO",
  ufCrm128StageCode: "DOCUMENTS",
  ufCrm128CaseStatus: "ACTIVE",
});
assert.equal(Object.values(payload).includes("private@example.com"), false);
assert.equal(Object.values(payload).includes("+70000000000"), false);

for (const raw of [
  "caseNumber=title,planCode=plan,stageCode=stage",
  "caseNumber=title,planCode=plan,stageCode=stage,status=status,extra=value",
  "caseNumber=title,caseNumber=second,stageCode=stage,status=status",
  "caseNumber=title,planCode=title,stageCode=stage,status=status",
  "caseNumber=constructor,planCode=plan,stageCode=stage,status=status",
  "caseNumber=title,planCode=bad-field,stageCode=stage,status=status",
]) {
  assert.throws(() => parseBitrix24CaseFieldMap(raw), new RegExp(BITRIX24_CASE_FIELD_MAP_INVALID));
}

assert.throws(
  () =>
    buildBitrix24CaseProjection({
      caseNumber: "IB-1\nInjected",
      planCode: "PRO",
      stageCode: "START",
      status: "ACTIVE",
    }),
  new RegExp(BITRIX24_CASE_PROJECTION_INVALID),
);
assert.throws(
  () =>
    buildBitrix24CaseProjection({
      caseNumber: "IB-1",
      planCode: "invalid plan with spaces",
      stageCode: "START",
      status: "ACTIVE",
    }),
  new RegExp(BITRIX24_CASE_PROJECTION_INVALID),
);

console.log("BITRIX24_CASE_PROJECTION_TEST_PASS");

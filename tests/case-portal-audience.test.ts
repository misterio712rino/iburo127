import assert from "node:assert/strict";

import {
  CASE_PORTAL_AUDIENCE_UNRESOLVED,
  resolveCasePortalAudience,
} from "@/lib/platform/case-portal-audience";
import type {
  AuthenticatedActor,
  ClientCaseRecord,
} from "@/server/domain/client-cases/contracts";

const ownedCase: ClientCaseRecord = {
  id: "case-owned",
  caseNumber: "IBR-OWNED",
  clientId: "user-1",
  planCode: "PRO",
  stageCode: "QUESTIONNAIRE",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};
const otherCase: ClientCaseRecord = {
  ...ownedCase,
  id: "case-other",
  caseNumber: "IBR-OTHER",
  clientId: "client-2",
  assignedLawyerId: "user-1",
};

const client: AuthenticatedActor = { userId: "user-1", roles: ["CLIENT"] };
const lawyer: AuthenticatedActor = { userId: "user-1", roles: ["LAWYER"] };
const manager: AuthenticatedActor = { userId: "user-1", roles: ["MANAGER"] };
const dualRole: AuthenticatedActor = { userId: "user-1", roles: ["CLIENT", "MANAGER"] };
const clientLawyer: AuthenticatedActor = { userId: "user-1", roles: ["CLIENT", "LAWYER"] };

assert.equal(resolveCasePortalAudience(client, ownedCase), "CLIENT");
assert.equal(resolveCasePortalAudience(lawyer, otherCase), "STAFF");
assert.equal(resolveCasePortalAudience(manager, otherCase), "STAFF");
assert.equal(
  resolveCasePortalAudience(dualRole, ownedCase),
  "CLIENT",
  "an owned case must stay in CLIENT context even when the account also has a staff role",
);
assert.equal(
  resolveCasePortalAudience(dualRole, otherCase),
  "STAFF",
  "a multi-role account must use STAFF context for another client's case",
);
assert.equal(resolveCasePortalAudience(clientLawyer, otherCase), "STAFF");
assert.throws(
  () => resolveCasePortalAudience(client, otherCase),
  new RegExp(CASE_PORTAL_AUDIENCE_UNRESOLVED),
  "a CLIENT-only actor must fail closed if handed a case they do not own",
);

console.log("CASE_PORTAL_AUDIENCE_TEST_PASS");

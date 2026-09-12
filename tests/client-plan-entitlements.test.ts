import assert from "node:assert/strict";

import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";
import {
  canAccessClientCase,
  canAccessClientCaseAsStaff,
} from "@/server/domain/client-cases/access-policy";
import type {
  AuthenticatedActor,
  ClientCaseAccessScope,
  ClientCaseRecord,
  ClientCaseRepository,
} from "@/server/domain/client-cases/contracts";
import { ClientCaseService } from "@/server/domain/client-cases/service";
import type {
  CaseDocumentRecord,
  CaseDocumentRepository,
  CaseDocumentStatus,
} from "@/server/domain/documents/contracts";
import {
  CaseDocumentService,
  DOCUMENT_FORBIDDEN,
} from "@/server/domain/documents/service";
import type { QuestionnaireService } from "@/server/domain/questionnaire/service";
import { STAGING_PLAN_FEATURE_CODES } from "@/server/staging/domain-fixtures";

function hasFeature(codes: readonly string[], featureCode: string) {
  return codes.includes(featureCode);
}

assert.equal(clientPlanHasHumanSupport("LITE"), false);
assert.equal(clientPlanHasHumanSupport("PRO"), true);
assert.equal(clientPlanHasHumanSupport("INDIVIDUAL"), true);
assert.equal(clientPlanHasHumanSupport("UNKNOWN"), false, "unknown plans must fail closed");

for (const planCode of ["LITE", "PRO", "INDIVIDUAL"] as const) {
  assert.ok(
    hasFeature(STAGING_PLAN_FEATURE_CODES[planCode], "AI_ASSISTANT"),
    `${planCode} must retain AI_ASSISTANT`,
  );
}
assert.equal(
  hasFeature(STAGING_PLAN_FEATURE_CODES.LITE, "MORTGAGE_ANALYSIS"),
  false,
  "LITE must not gain the mortgage entitlement",
);
assert.ok(hasFeature(STAGING_PLAN_FEATURE_CODES.PRO, "MORTGAGE_ANALYSIS"));
assert.ok(hasFeature(STAGING_PLAN_FEATURE_CODES.INDIVIDUAL, "MORTGAGE_ANALYSIS"));

const client: AuthenticatedActor = { userId: "client-1", roles: ["CLIENT"] };
const assignedLawyer: AuthenticatedActor = { userId: "lawyer-1", roles: ["LAWYER"] };
const manager: AuthenticatedActor = { userId: "manager-1", roles: ["MANAGER"] };

const liteCase: ClientCaseRecord = {
  id: "case-lite",
  caseNumber: "IBR-LITE",
  clientId: client.userId,
  planCode: "LITE",
  stageCode: "DOCUMENT_PREPARATION",
  assignedLawyerId: assignedLawyer.userId,
  status: "ACTIVE",
};
const proCase: ClientCaseRecord = {
  ...liteCase,
  id: "case-pro",
  caseNumber: "IBR-PRO",
  planCode: "PRO",
};
const individualCase: ClientCaseRecord = {
  ...liteCase,
  id: "case-individual",
  caseNumber: "IBR-INDIVIDUAL",
  planCode: "INDIVIDUAL",
};

assert.equal(canAccessClientCase(client, liteCase), true, "LITE client must retain own-case access");
assert.equal(
  canAccessClientCase(assignedLawyer, liteCase),
  false,
  "an accidental LITE lawyer assignment must not create human-support access",
);
assert.equal(canAccessClientCaseAsStaff(assignedLawyer, liteCase), false);
assert.equal(
  canAccessClientCase(manager, liteCase),
  true,
  "MANAGER oversight must remain read-only and plan-agnostic",
);
assert.equal(canAccessClientCaseAsStaff(manager, liteCase), true);
assert.equal(canAccessClientCase(assignedLawyer, proCase), true);
assert.equal(canAccessClientCaseAsStaff(assignedLawyer, proCase), true);
assert.equal(canAccessClientCase(assignedLawyer, individualCase), true);

class PlanCaseRepository implements ClientCaseRepository {
  current: ClientCaseRecord = liteCase;

  async findAccessibleCase(scope: ClientCaseAccessScope) {
    if (scope.caseId && scope.caseId !== this.current.id) return null;
    if (scope.caseNumber && scope.caseNumber !== this.current.caseNumber) return null;
    return this.current;
  }

  async listAccessibleCases() {
    return [this.current];
  }
}

class PlanDocumentRepository implements CaseDocumentRepository {
  sendCalls = 0;
  reviewCalls = 0;
  current: CaseDocumentRecord = {
    id: "document-plan-boundary",
    clientCaseId: liteCase.id,
    documentCode: "petition",
    status: "READY_FOR_REVIEW",
    regeneratedAt: new Date("2026-09-06T12:00:00.000Z"),
    sentForReviewAt: null,
    reviewedAt: null,
    version: 1,
    createdAt: new Date("2026-09-06T12:00:00.000Z"),
    updatedAt: new Date("2026-09-06T12:00:00.000Z"),
  };

  async getByCaseAndCode(clientCaseId: string, documentCode: string) {
    return this.current.clientCaseId === clientCaseId && this.current.documentCode === documentCode
      ? this.current
      : null;
  }

  async listByCase(clientCaseId: string) {
    return this.current.clientCaseId === clientCaseId ? [this.current] : [];
  }

  async createForCase(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
  }) {
    this.current = { ...this.current, ...input };
    return this.current;
  }

  async regenerate(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
    expectedVersion: number;
    auditActorUserId: string;
  }) {
    this.current = { ...this.current, status: input.status, version: input.expectedVersion + 1 };
    return this.current;
  }

  async sendForReview(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
    auditActorUserId: string;
  }) {
    this.sendCalls += 1;
    this.current = {
      ...this.current,
      status: "SENT_FOR_REVIEW",
      version: input.expectedVersion + 1,
    };
    return this.current;
  }

  async markReviewed(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
    auditActorUserId: string;
  }) {
    this.reviewCalls += 1;
    this.current = {
      ...this.current,
      status: "REVIEWED",
      version: input.expectedVersion + 1,
    };
    return this.current;
  }
}

const caseRepository = new PlanCaseRepository();
const documentRepository = new PlanDocumentRepository();
const documentService = new CaseDocumentService(
  new ClientCaseService(caseRepository),
  {} as QuestionnaireService,
  documentRepository,
  new Map([["petition", { code: "petition", requiredFieldIds: [] }]]),
);

await assert.rejects(
  documentService.sendForReview(client, {
    clientCaseId: liteCase.id,
    documentCode: "petition",
    expectedVersion: documentRepository.current.version,
  }),
  new RegExp(DOCUMENT_FORBIDDEN),
  "LITE must not enter the human document-review workflow",
);
assert.equal(documentRepository.sendCalls, 0);

caseRepository.current = proCase;
documentRepository.current = {
  ...documentRepository.current,
  clientCaseId: proCase.id,
  status: "READY_FOR_REVIEW",
  version: 1,
};
const sent = await documentService.sendForReview(client, {
  clientCaseId: proCase.id,
  documentCode: "petition",
  expectedVersion: documentRepository.current.version,
});
assert.equal(sent.status, "SENT_FOR_REVIEW");
assert.equal(documentRepository.sendCalls, 1, "PRO must retain human document review");

const reviewed = await documentService.markReviewed(assignedLawyer, {
  clientCaseId: proCase.id,
  documentCode: "petition",
  expectedVersion: documentRepository.current.version,
});
assert.equal(reviewed.status, "REVIEWED");
assert.equal(documentRepository.reviewCalls, 1);

caseRepository.current = liteCase;
documentRepository.current = {
  ...documentRepository.current,
  clientCaseId: liteCase.id,
  status: "SENT_FOR_REVIEW",
  version: 4,
};
await assert.rejects(
  documentService.markReviewed(assignedLawyer, {
    clientCaseId: liteCase.id,
    documentCode: "petition",
    expectedVersion: documentRepository.current.version,
  }),
  /DOCUMENT_(?:CASE_NOT_FOUND|FORBIDDEN)/,
  "LITE must reject lawyer review even if stale data still carries an assignment",
);
assert.equal(documentRepository.reviewCalls, 1);

console.log("CLIENT_PLAN_ENTITLEMENTS_TEST_PASS");

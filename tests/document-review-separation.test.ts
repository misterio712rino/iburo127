import assert from "node:assert/strict";

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

const now = new Date("2026-08-29T12:00:00.000Z");

const clientCase: ClientCaseRecord = {
  id: "case-self-review",
  caseNumber: "IBR-SELF-REVIEW",
  clientId: "client-manager-1",
  planCode: "PRO",
  stageCode: "LAWYER_REVIEW",
  assignedLawyerId: "lawyer-1",
  status: "ACTIVE",
};

class ReviewCaseRepository implements ClientCaseRepository {
  async findAccessibleCase(scope: ClientCaseAccessScope) {
    if (scope.caseId && scope.caseId !== clientCase.id) return null;
    if (scope.caseNumber && scope.caseNumber !== clientCase.caseNumber) return null;
    if (scope.actor.roles.includes("MANAGER")) return clientCase;
    if (
      scope.actor.roles.includes("LAWYER") &&
      scope.actor.userId === clientCase.assignedLawyerId
    ) {
      return clientCase;
    }
    if (
      scope.actor.roles.includes("CLIENT") &&
      scope.actor.userId === clientCase.clientId
    ) {
      return clientCase;
    }
    return null;
  }

  async listAccessibleCases(actor: AuthenticatedActor) {
    return (await this.findAccessibleCase({ actor, caseId: clientCase.id }))
      ? [clientCase]
      : [];
  }
}

class ReviewDocumentRepository implements CaseDocumentRepository {
  reviewCalls = 0;
  current: CaseDocumentRecord = {
    id: "document-1",
    clientCaseId: clientCase.id,
    documentCode: "petition",
    status: "SENT_FOR_REVIEW",
    regeneratedAt: now,
    sentForReviewAt: now,
    reviewedAt: null,
    version: 3,
    createdAt: now,
    updatedAt: now,
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
    this.current = {
      ...this.current,
      clientCaseId: input.clientCaseId,
      documentCode: input.documentCode,
      status: input.status,
    };
    return this.current;
  }

  async regenerate(input: {
    clientCaseId: string;
    documentCode: string;
    status: CaseDocumentStatus;
    expectedVersion: number;
    auditActorUserId: string;
  }) {
    this.current = {
      ...this.current,
      status: input.status,
      version: input.expectedVersion + 1,
      regeneratedAt: now,
    };
    return this.current;
  }

  async sendForReview(input: {
    clientCaseId: string;
    documentCode: string;
    expectedVersion: number;
    auditActorUserId: string;
  }) {
    this.current = {
      ...this.current,
      status: "SENT_FOR_REVIEW",
      version: input.expectedVersion + 1,
      sentForReviewAt: now,
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
      reviewedAt: now,
    };
    return this.current;
  }
}

const repository = new ReviewDocumentRepository();
const service = new CaseDocumentService(
  new ClientCaseService(new ReviewCaseRepository()),
  {} as unknown as QuestionnaireService,
  repository,
  new Map([["petition", { code: "petition", requiredFieldIds: [] }]]),
);

const selfReviewer: AuthenticatedActor = {
  userId: clientCase.clientId,
  roles: ["CLIENT", "MANAGER"],
};
await assert.rejects(
  service.markReviewed(selfReviewer, {
    clientCaseId: clientCase.id,
    documentCode: "petition",
    expectedVersion: repository.current.version,
  }),
  new RegExp(DOCUMENT_FORBIDDEN),
  "a staff-capable account must not approve documents for its own client case",
);
assert.equal(repository.reviewCalls, 0, "self-review must be rejected before repository mutation");

const manager: AuthenticatedActor = {
  userId: "manager-2",
  roles: ["MANAGER"],
};
const reviewed = await service.markReviewed(manager, {
  clientCaseId: clientCase.id,
  documentCode: "petition",
  expectedVersion: repository.current.version,
});
assert.equal(reviewed.status, "REVIEWED");
assert.equal(repository.reviewCalls, 1, "an independent manager must retain review capability");

console.log("DOCUMENT_REVIEW_SEPARATION_TEST_PASS");

import "server-only";

import {
  buildCaseProgressSummary,
  type CaseProgressAudience,
} from "@/lib/platform/case-progress";
import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";
import { PRACTICUM_LESSONS } from "@/lib/platform/practicum-content";
import { QUESTIONNAIRE_SECTIONS } from "@/lib/platform/questionnaire-content";
import type {
  AuthenticatedActor,
  ClientCaseRecord,
} from "@/server/domain/client-cases/contracts";
import { caseDocumentService } from "@/server/documents/runtime";
import { storedFileService } from "@/server/files/runtime";
import { practicumService } from "@/server/practicum/runtime";
import { questionnaireService } from "@/server/questionnaire/runtime";

export async function getCaseProgressSummaryForActor(
  actor: AuthenticatedActor,
  clientCase: ClientCaseRecord,
  audience: CaseProgressAudience,
) {
  const [questionnaire, practicum, documents, visibleFiles] = await Promise.all([
    questionnaireService.get(actor, clientCase.id),
    practicumService.get(actor, clientCase.id),
    caseDocumentService.list(actor, clientCase.id),
    storedFileService.list(actor, clientCase.id),
  ]);

  return buildCaseProgressSummary({
    audience,
    caseStatus: clientCase.status,
    stageCode: clientCase.stageCode,
    humanSupportAvailable: clientPlanHasHumanSupport(clientCase.planCode),
    questionnaire: {
      status: questionnaire?.status ?? "NOT_STARTED",
      completedSectionCount: questionnaire?.completedSectionIds.length ?? 0,
      totalSectionCount: QUESTIONNAIRE_SECTIONS.length,
    },
    practicum: {
      status: practicum?.completedAt
        ? "COMPLETED"
        : (practicum?.completedLessonIds.length ?? 0) > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED",
      completedLessonCount: practicum?.completedLessonIds.length ?? 0,
      totalLessonCount: PRACTICUM_LESSONS.length,
    },
    documents: documents.map((document) => ({ status: document.status })),
    readyFileCount: visibleFiles.filter((file) => file.status === "READY").length,
  });
}

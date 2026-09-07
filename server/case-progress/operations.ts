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
  const [questionnaire, practicum, documents, readyFiles] = await Promise.all([
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
    questionnaire: questionnaire
      ? {
          status: questionnaire.status,
          completedSectionCount: questionnaire.completedSectionIds.length,
          totalSectionCount: QUESTIONNAIRE_SECTIONS.length,
        }
      : null,
    practicum: practicum
      ? {
          status: practicum.completedAt
            ? "COMPLETED"
            : practicum.completedLessonIds.length > 0
              ? "IN_PROGRESS"
              : "NOT_STARTED",
          completedLessonCount: practicum.completedLessonIds.length,
          totalLessonCount: PRACTICUM_LESSONS.length,
        }
      : null,
    documents: documents.map((document) => ({ status: document.status })),
    readyFileCount: readyFiles.length,
  });
}

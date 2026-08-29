import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CLIENT_FACING_SOURCES = [
  "app/portal/cases/[caseId]/page.tsx",
  "app/portal/cases/[caseId]/questionnaire/page.tsx",
  "components/platform/questionnaire/ProductionQuestionnaire.tsx",
  "app/portal/cases/[caseId]/practicum/page.tsx",
  "components/platform/practicum/ProductionPracticum.tsx",
  "app/portal/cases/[caseId]/documents/page.tsx",
  "components/platform/documents/ProductionDocuments.tsx",
  "app/portal/cases/[caseId]/files/page.tsx",
  "components/platform/files/ProductionFiles.tsx",
  "app/portal/cases/[caseId]/progress/page.tsx",
  "app/portal/cases/[caseId]/ai/page.tsx",
  "components/platform/ai/AiAssistant.tsx",
  "app/portal/notifications/page.tsx",
  "app/portal/profile/page.tsx",
] as const;

const BANNED_CLIENT_COPY = [
  /PostgreSQL/i,
  /object storage/i,
  /PENDING_UPLOAD/i,
  /server-side/i,
  /malware scan/i,
  /localStorage/i,
  /серверный workflow/i,
  /серверной базе/i,
  /Серверное состояние/i,
  /внутреннего пользователя/i,
  /внутренней учётной записи/i,
] as const;

for (const path of CLIENT_FACING_SOURCES) {
  const source = await readFile(resolve(path), "utf8");
  for (const banned of BANNED_CLIENT_COPY) {
    assert.doesNotMatch(
      source,
      banned,
      `${path} must not expose implementation jargon matching ${banned}`,
    );
  }
}

console.log("CLIENT_FACING_COPY_CONTRACT_TEST_PASS");

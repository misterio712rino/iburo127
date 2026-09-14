import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CLIENT_FACING_SOURCES = [
  "app/portal/cases/[caseId]/page.tsx",
  "components/portal/ProductionDemoClientDashboard.tsx",
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
  "components/platform/ai/AiContextPanel.tsx",
  "components/platform/ai/AiLockedState.tsx",
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
  /Общий прогресс/i,
] as const;

for (const path of CLIENT_FACING_SOURCES) {
  const source = await readFile(resolve(path), "utf8");
  for (const banned of BANNED_CLIENT_COPY) {
    assert.doesNotMatch(
      source,
      banned,
      `${path} must not expose implementation or misleading client copy matching ${banned}`,
    );
  }
}

const clientDashboardSource = await readFile(
  resolve("components/portal/ProductionDemoClientDashboard.tsx"),
  "utf8",
);
assert.match(clientDashboardSource, /Положение этапа в маршруте/u);
assert.match(clientDashboardSource, /Это не прогноз срока или результата процедуры\./u);

const aiAssistantSource = await readFile(
  resolve("components/platform/ai/AiAssistant.tsx"),
  "utf8",
);
assert.match(aiAssistantSource, /clientPlanHasHumanSupport\(caseState\.planCode\)/);
assert.match(aiAssistantSource, /SELF_SERVICE_AI_SUGGESTIONS/);
assert.match(aiAssistantSource, /HUMAN_SUPPORT_AI_SUGGESTIONS/);
assert.match(aiAssistantSource, /Как самостоятельно проверить документы перед подачей\?/u);
assert.match(aiAssistantSource, /Зачем нужна проверка юриста\?/u);

const aiContextSource = await readFile(
  resolve("components/platform/ai/AiContextPanel.tsx"),
  "utf8",
);
assert.match(aiContextSource, /clientPlanHasHumanSupport\(context\.planCode\)/);
assert.match(aiContextSource, /Самостоятельная проверка документов/u);
assert.match(aiContextSource, /готовы к самостоятельной проверке/u);
assert.match(aiContextSource, /Сопровождение специалистом не входит в тариф Лайт\./u);
assert.match(aiContextSource, /не даёт окончательное юридическое заключение/u);

const aiLockedSource = await readFile(
  resolve("components/platform/ai/AiLockedState.tsx"),
  "utf8",
);
assert.match(aiLockedSource, /if \(planCode === "INDIVIDUAL"\) return "Эксклюзив";/);
assert.match(aiLockedSource, /<IBuroBrand \/>/);
assert.doesNotMatch(aiLockedSource, /ИНДИВИДУАЛЬНЫЙ/u);
assert.doesNotMatch(aiLockedSource, /тарифах iБюро/u);

console.log("CLIENT_FACING_COPY_CONTRACT_TEST_PASS");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAiAuditMetadata, assertAiAuditId } from "@/server/ai/audit-correlation";
import { sanitizeActivityMetadata } from "@/server/domain/activity/taxonomy";

const auditId = "123e4567-e89b-42d3-a456-426614174000";
assert.equal(assertAiAuditId(` ${auditId.toUpperCase()} `), auditId);
assert.deepEqual(buildAiAuditMetadata(auditId), {
  schemaVersion: 1,
  auditId,
});
assert.deepEqual(sanitizeActivityMetadata(buildAiAuditMetadata(auditId)), {
  schemaVersion: 1,
  auditId,
});

for (const invalid of [
  "",
  "client@example.test",
  "22222222-2222-2222-2222-222222222222",
  "123e4567-e89b-12d3-a456-426614174000",
  "123e4567-e89b-42d3-7456-426614174000",
]) {
  assert.throws(() => assertAiAuditId(invalid), /AI_AUDIT_INVALID_ID/);
}

const [
  aiRepositorySource,
  aiServiceSource,
  aiPolicySource,
  aiClientApiSource,
  aiContextPanelSource,
  aiLockedStateSource,
] = await Promise.all([
  readFile(resolve("server/repositories/prisma/ai-case-context-repository.ts"), "utf8"),
  readFile(resolve("server/domain/ai/service.ts"), "utf8"),
  readFile(resolve("server/domain/ai/policy.ts"), "utf8"),
  readFile(resolve("components/platform/ai/production-api.ts"), "utf8"),
  readFile(resolve("components/platform/ai/AiContextPanel.tsx"), "utf8"),
  readFile(resolve("components/platform/ai/AiLockedState.tsx"), "utf8"),
]);

assert.doesNotMatch(
  aiRepositorySource,
  /\btasks\s*:|countTaskStatuses|taskSummary/,
  "CLIENT AI repository must not read or aggregate STAFF-only tasks",
);
assert.doesNotMatch(
  aiServiceSource,
  /taskSummary/,
  "CLIENT AI response must not expose STAFF task summaries",
);
assert.doesNotMatch(
  aiPolicySource,
  /taskSummary:\s*context\.taskSummary/,
  "AI provider context must not receive STAFF task summaries",
);
assert.doesNotMatch(
  aiClientApiSource,
  /taskSummary/,
  "CLIENT AI DTO must not include STAFF task summaries",
);
assert.doesNotMatch(
  aiContextPanelSource,
  /taskSummary|Открытые задачи/,
  "CLIENT AI panel must not reveal STAFF task counts",
);
assert.match(
  aiContextPanelSource,
  /STAGE_LABELS\[context\.stageCode\]\s*\?\?\s*"Этап уточняется"/,
  "unknown internal stage codes must fail closed in CLIENT copy",
);
assert.match(
  aiContextPanelSource,
  /document\.status === "READY_FOR_REVIEW"/,
  "document summary must count documents that are actually ready for review",
);
assert.doesNotMatch(
  aiContextPanelSource,
  /document\.status === "REVIEWED"/,
  "reviewed documents must not be described as still ready for review",
);
assert.doesNotMatch(
  aiLockedStateSource,
  /return planCode;/,
  "unknown internal plan codes must not be rendered back to the CLIENT",
);

await import("./ai-plan-entitlement-contract.test");
await import("./client-facing-copy-contract.test");
await import("./task-case-authorization.test");
await import("./document-review-separation.test");

console.log("AI_AUDIT_CORRELATION_TEST_PASS");

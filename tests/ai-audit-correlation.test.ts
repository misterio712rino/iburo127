import assert from "node:assert/strict";
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

console.log("AI_AUDIT_CORRELATION_TEST_PASS");

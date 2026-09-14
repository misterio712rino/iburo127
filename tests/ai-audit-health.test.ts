import assert from "node:assert/strict";
import {
  AiAuditHealthService,
  type AiAuditHealthRepository,
} from "@/server/ai/audit-health";

const now = new Date("2026-08-29T00:00:00.000Z");
let capturedCutoff: Date | undefined;
let capturedLimit: number | undefined;
let nextCount = 0;

const repository: AiAuditHealthRepository = {
  async countOrphanedAccepted(input) {
    capturedCutoff = input.cutoff;
    capturedLimit = input.limit;
    return nextCount;
  },
};

const service = new AiAuditHealthService(repository);

const healthy = await service.check({ now, graceMinutes: 10, limit: 50 });
assert.deepEqual(healthy, {
  orphanCount: 0,
  saturated: false,
  graceMinutes: 10,
  batchLimit: 50,
});
assert.equal(capturedCutoff?.toISOString(), "2026-08-28T23:50:00.000Z");
assert.equal(capturedLimit, 50);

nextCount = 3;
const unhealthy = await service.check({ now, graceMinutes: 15, limit: 20 });
assert.deepEqual(unhealthy, {
  orphanCount: 3,
  saturated: false,
  graceMinutes: 15,
  batchLimit: 20,
});

nextCount = 20;
const saturated = await service.check({ now, graceMinutes: 15, limit: 20 });
assert.equal(saturated.orphanCount, 20);
assert.equal(saturated.saturated, true);

for (const invalid of [
  { now, graceMinutes: 1, limit: 20 },
  { now, graceMinutes: 1441, limit: 20 },
  { now, graceMinutes: 10, limit: 0 },
  { now, graceMinutes: 10, limit: 201 },
  { now: new Date("invalid"), graceMinutes: 10, limit: 20 },
]) {
  await assert.rejects(() => service.check(invalid), /AI_AUDIT_HEALTH_INVALID_CONFIG/);
}

for (const invalidResult of [-1, 21, 1.5]) {
  nextCount = invalidResult;
  await assert.rejects(
    () => service.check({ now, graceMinutes: 10, limit: 20 }),
    /AI_AUDIT_HEALTH_INVALID_RESULT/,
  );
}

console.log("AI_AUDIT_HEALTH_TEST_PASS");

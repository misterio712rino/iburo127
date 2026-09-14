import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  STALE_UPLOAD_HEALTH_INVALID_INPUT,
  StaleUploadHealthService,
  type StaleUploadHealthRepository,
  type StaleUploadHealthSnapshot,
} from "@/server/domain/files/stale-upload-health";

const now = new Date("2026-08-29T12:00:00.000Z");

class FakeRepository implements StaleUploadHealthRepository {
  input: { overdueBefore: Date; limit: number } | null = null;

  constructor(private readonly snapshot: StaleUploadHealthSnapshot) {}

  async inspect(input: { overdueBefore: Date; limit: number }) {
    this.input = input;
    return this.snapshot;
  }
}

const healthyRepository = new FakeRepository({ overdue: 0, saturated: false });
const healthy = await new StaleUploadHealthService(healthyRepository).inspect({
  now,
  maxAgeMinutes: 60,
  graceMinutes: 30,
  limit: 50,
});
assert.deepEqual(healthy, {
  overdue: 0,
  saturated: false,
  healthy: true,
  maxAgeMinutes: 60,
  graceMinutes: 30,
  batchLimit: 50,
});
assert.equal(
  healthyRepository.input?.overdueBefore.toISOString(),
  "2026-08-29T10:30:00.000Z",
);
assert.equal(healthyRepository.input?.limit, 50);

for (const snapshot of [
  { overdue: 1, saturated: false },
  { overdue: 50, saturated: true },
]) {
  const result = await new StaleUploadHealthService(new FakeRepository(snapshot)).inspect({
    now,
    maxAgeMinutes: 60,
    graceMinutes: 30,
    limit: 50,
  });
  assert.equal(result.healthy, false);
}

const service = new StaleUploadHealthService(healthyRepository);
await assert.rejects(
  service.inspect({ now: new Date("invalid"), maxAgeMinutes: 60, graceMinutes: 30, limit: 50 }),
  new RegExp(STALE_UPLOAD_HEALTH_INVALID_INPUT),
);
await assert.rejects(
  service.inspect({ now, maxAgeMinutes: 14, graceMinutes: 30, limit: 50 }),
  new RegExp(STALE_UPLOAD_HEALTH_INVALID_INPUT),
);
await assert.rejects(
  service.inspect({ now, maxAgeMinutes: 60, graceMinutes: 0, limit: 50 }),
  new RegExp(STALE_UPLOAD_HEALTH_INVALID_INPUT),
);
await assert.rejects(
  service.inspect({ now, maxAgeMinutes: 60, graceMinutes: 30, limit: 0 }),
  new RegExp(STALE_UPLOAD_HEALTH_INVALID_INPUT),
);

const repositorySource = await readFile(
  resolve("server/repositories/prisma/stale-upload-health-repository.ts"),
  "utf8",
);
assert.match(repositorySource, /status: "PENDING_UPLOAD"/);
assert.match(repositorySource, /createdAt: \{ lte: input\.overdueBefore \}/);
assert.match(repositorySource, /select: \{ id: true \}/);
assert.match(repositorySource, /take: input\.limit \+ 1/);
assert.doesNotMatch(repositorySource, /fileName:\s*true/);
assert.doesNotMatch(repositorySource, /objectKey:\s*true/);
assert.doesNotMatch(repositorySource, /clientCaseId:\s*true/);
assert.doesNotMatch(repositorySource, /uploadedById:\s*true/);

const configSource = await readFile(resolve("server/config/production.ts"), "utf8");
assert.match(
  configSource,
  /"IB_STALE_UPLOAD_HEALTH_GRACE_MINUTES",\s*30,\s*5,\s*1_440/,
);
assert.match(
  configSource,
  /"IB_STALE_UPLOAD_HEALTH_BATCH_LIMIT",\s*50,\s*1,\s*200/,
);

console.log("STALE_UPLOAD_HEALTH_TEST_PASS");

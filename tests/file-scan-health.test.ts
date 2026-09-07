import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FILE_SCAN_HEALTH_INVALID_INPUT,
  StoredFileScanHealthService,
  type StoredFileScanHealthRepository,
  type StoredFileScanHealthSnapshot,
} from "@/server/domain/files/scan-health";

const now = new Date("2026-08-29T12:00:00.000Z");

class FakeRepository implements StoredFileScanHealthRepository {
  input: { overdueBefore: Date; limit: number } | null = null;

  constructor(private readonly snapshot: StoredFileScanHealthSnapshot) {}

  async inspect(input: { overdueBefore: Date; limit: number }) {
    this.input = input;
    return this.snapshot;
  }
}

const healthyRepository = new FakeRepository({
  overduePending: 0,
  expiredLeases: 0,
  terminalFailures: 0,
  saturated: false,
});
const healthy = await new StoredFileScanHealthService(healthyRepository).inspect({
  now,
  graceMinutes: 15,
  limit: 50,
});
assert.deepEqual(healthy, {
  overduePending: 0,
  expiredLeases: 0,
  terminalFailures: 0,
  saturated: false,
  healthy: true,
  graceMinutes: 15,
  batchLimit: 50,
});
assert.equal(
  healthyRepository.input?.overdueBefore.toISOString(),
  "2026-08-29T11:45:00.000Z",
);
assert.equal(healthyRepository.input?.limit, 50);

for (const snapshot of [
  { overduePending: 1, expiredLeases: 0, terminalFailures: 0, saturated: false },
  { overduePending: 0, expiredLeases: 1, terminalFailures: 0, saturated: false },
  { overduePending: 0, expiredLeases: 0, terminalFailures: 1, saturated: false },
  { overduePending: 50, expiredLeases: 0, terminalFailures: 0, saturated: true },
]) {
  const result = await new StoredFileScanHealthService(new FakeRepository(snapshot)).inspect({
    now,
    graceMinutes: 15,
    limit: 50,
  });
  assert.equal(result.healthy, false);
}

const service = new StoredFileScanHealthService(healthyRepository);
await assert.rejects(
  service.inspect({ now: new Date("invalid"), graceMinutes: 15, limit: 50 }),
  new RegExp(FILE_SCAN_HEALTH_INVALID_INPUT),
);
await assert.rejects(
  service.inspect({ now, graceMinutes: 0, limit: 50 }),
  new RegExp(FILE_SCAN_HEALTH_INVALID_INPUT),
);
await assert.rejects(
  service.inspect({ now, graceMinutes: 15, limit: 0 }),
  new RegExp(FILE_SCAN_HEALTH_INVALID_INPUT),
);

const repositorySource = await readFile(
  resolve("server/repositories/prisma/file-scan-health-repository.ts"),
  "utf8",
);
assert.match(repositorySource, /const take = input\.limit \+ 1/);
assert.match(repositorySource, /status: "PENDING_SCAN"/);
assert.match(repositorySource, /status: "SCANNING"/);
assert.match(repositorySource, /status: "SCAN_FAILED"/);
assert.match(repositorySource, /scanNextAttemptAt: \{ lte: input\.overdueBefore \}/);
assert.match(repositorySource, /scanLeaseUntil: \{ lte: input\.overdueBefore \}/);
assert.match(repositorySource, /select: \{ id: true \}/);
assert.doesNotMatch(repositorySource, /fileName:\s*true/);
assert.doesNotMatch(repositorySource, /objectKey:\s*true/);
assert.doesNotMatch(repositorySource, /clientCaseId:\s*true/);
assert.doesNotMatch(repositorySource, /uploadedById:\s*true/);

const configSource = await readFile(resolve("server/config/production.ts"), "utf8");
assert.match(
  configSource,
  /"IB_FILE_SCAN_HEALTH_GRACE_MINUTES",\s*15,\s*2,\s*1_440/,
);
assert.match(
  configSource,
  /"IB_FILE_SCAN_HEALTH_BATCH_LIMIT",\s*50,\s*1,\s*200/,
);

console.log("FILE_SCAN_HEALTH_TEST_PASS");

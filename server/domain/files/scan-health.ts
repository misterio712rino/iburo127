export const FILE_SCAN_HEALTH_INVALID_INPUT = "FILE_SCAN_HEALTH_INVALID_INPUT";

export type StoredFileScanHealthSnapshot = {
  overduePending: number;
  expiredLeases: number;
  terminalFailures: number;
  saturated: boolean;
};

export interface StoredFileScanHealthRepository {
  inspect(input: {
    overdueBefore: Date;
    limit: number;
  }): Promise<StoredFileScanHealthSnapshot>;
}

function requireInteger(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(FILE_SCAN_HEALTH_INVALID_INPUT);
  }
  return value;
}

export class StoredFileScanHealthService {
  constructor(private readonly repository: StoredFileScanHealthRepository) {}

  async inspect(input: {
    now: Date;
    graceMinutes: number;
    limit: number;
  }) {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(FILE_SCAN_HEALTH_INVALID_INPUT);
    }
    const graceMinutes = requireInteger(input.graceMinutes, 1, 1_440);
    const limit = requireInteger(input.limit, 1, 500);
    const overdueBefore = new Date(input.now.getTime() - graceMinutes * 60_000);

    const snapshot = await this.repository.inspect({ overdueBefore, limit });
    const healthy =
      snapshot.overduePending === 0 &&
      snapshot.expiredLeases === 0 &&
      snapshot.terminalFailures === 0 &&
      !snapshot.saturated;

    return {
      ...snapshot,
      healthy,
      graceMinutes,
      batchLimit: limit,
    };
  }
}

export const STALE_UPLOAD_HEALTH_INVALID_INPUT = "STALE_UPLOAD_HEALTH_INVALID_INPUT";

export type StaleUploadHealthSnapshot = {
  overdue: number;
  saturated: boolean;
};

export interface StaleUploadHealthRepository {
  inspect(input: {
    overdueBefore: Date;
    limit: number;
  }): Promise<StaleUploadHealthSnapshot>;
}

function requireInteger(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(STALE_UPLOAD_HEALTH_INVALID_INPUT);
  }
  return value;
}

export class StaleUploadHealthService {
  constructor(private readonly repository: StaleUploadHealthRepository) {}

  async inspect(input: {
    now: Date;
    maxAgeMinutes: number;
    graceMinutes: number;
    limit: number;
  }) {
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      throw new Error(STALE_UPLOAD_HEALTH_INVALID_INPUT);
    }
    const maxAgeMinutes = requireInteger(input.maxAgeMinutes, 15, 10_080);
    const graceMinutes = requireInteger(input.graceMinutes, 1, 1_440);
    const limit = requireInteger(input.limit, 1, 500);
    const overdueBefore = new Date(
      input.now.getTime() - (maxAgeMinutes + graceMinutes) * 60_000,
    );

    const snapshot = await this.repository.inspect({ overdueBefore, limit });
    return {
      ...snapshot,
      healthy: snapshot.overdue === 0 && !snapshot.saturated,
      maxAgeMinutes,
      graceMinutes,
      batchLimit: limit,
    };
  }
}

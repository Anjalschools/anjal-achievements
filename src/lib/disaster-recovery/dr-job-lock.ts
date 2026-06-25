export type DrJobLockStatus = {
  locked: boolean;
  owner?: string;
  createdAt?: number;
  expiresAt?: number;
  lockAgeMs?: number;
  stale?: boolean;
};

const DEFAULT_LOCK_TTL_MS = 4 * 60 * 60 * 1000;

let activeLock: {
  owner: string;
  createdAt: number;
  expiresAt: number;
} | null = null;

const resolveLockTtlMs = (): number => {
  const raw = process.env.DR_JOB_LOCK_TTL_MS;
  if (!raw) return DEFAULT_LOCK_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCK_TTL_MS;
};

const clearStaleLock = (): void => {
  if (!activeLock) return;
  if (activeLock.expiresAt <= Date.now()) {
    activeLock = null;
  }
};

export const inspectDrJobLock = (recordId?: string): DrJobLockStatus => {
  clearStaleLock();
  const now = Date.now();

  if (!activeLock) {
    const status: DrJobLockStatus = { locked: false };
    console.info("[DR] DR_JOB_LOCK_STATUS", { recordId, ...status });
    return status;
  }

  const status: DrJobLockStatus = {
    locked: true,
    owner: activeLock.owner,
    createdAt: activeLock.createdAt,
    expiresAt: activeLock.expiresAt,
    lockAgeMs: now - activeLock.createdAt,
    stale: activeLock.expiresAt <= now,
  };

  console.info("[DR] DR_JOB_LOCK_STATUS", { recordId, ...status });
  return status;
};

export const acquireDrJobLock = (recordId: string): boolean => {
  const status = inspectDrJobLock(recordId);
  if (status.locked && status.owner !== recordId) {
    return false;
  }

  const now = Date.now();
  activeLock = {
    owner: recordId,
    createdAt: now,
    expiresAt: now + resolveLockTtlMs(),
  };
  return true;
};

export const releaseDrJobLock = (recordId: string): void => {
  if (activeLock?.owner === recordId) {
    activeLock = null;
  }
};

export const resetDrJobLock = (): void => {
  activeLock = null;
};

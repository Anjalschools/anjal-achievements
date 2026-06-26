import "server-only";

export type DrQueueIntegrityAudit = {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  orphan: number;
  recovered: number;
  reclaimed: number;
  duplicate: number;
  corrupted: number;
  repaired: number;
};

export type DrWorkerFailureContext = {
  recordId: string;
  queueEntryId?: string;
  workerId: string;
  attempt: number;
  jobPhase?: string;
  stage?: string;
  reason: string;
  retryable: boolean;
  elapsedMs?: number;
  lockOwner?: string;
  heartbeatAt?: string;
  leaseExpiresAt?: string;
};

const computeHeartbeatAgeMs = (heartbeatAt?: string): number | undefined => {
  if (!heartbeatAt) return undefined;
  const parsed = Date.parse(heartbeatAt);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Date.now() - parsed);
};

const computeLeaseRemainingMs = (leaseExpiresAt?: string): number | undefined => {
  if (!leaseExpiresAt) return undefined;
  const parsed = Date.parse(leaseExpiresAt);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed - Date.now();
};

export const logDrWorkerFailure = (context: DrWorkerFailureContext): void => {
  console.error("[DR] WORKER_FAILURE", {
    recordId: context.recordId,
    queueEntryId: context.queueEntryId,
    workerId: context.workerId,
    attempt: context.attempt,
    jobPhase: context.jobPhase,
    stage: context.stage,
    reason: context.reason,
    retryable: context.retryable,
    elapsedMs: context.elapsedMs,
    lockOwner: context.lockOwner,
    heartbeatAgeMs: computeHeartbeatAgeMs(context.heartbeatAt),
    leaseRemainingMs: computeLeaseRemainingMs(context.leaseExpiresAt),
    heartbeatAt: context.heartbeatAt,
    leaseExpiresAt: context.leaseExpiresAt,
  });
};

export type DrWorkerHealthSnapshot = {
  workerId: string;
  pid: number;
  uptime: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  processing: boolean;
  shuttingDown: boolean;
  queueSize: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  retryCount: number;
};

export const logDrWorkerHealth = (snapshot: DrWorkerHealthSnapshot): void => {
  console.info("[DR] WORKER_HEALTH", snapshot);
};

export const logDrQueueIntegrityAudit = (audit: DrQueueIntegrityAudit): void => {
  console.info("[DR] QUEUE_INTEGRITY_AUDIT", audit);
};

export const createEmptyDrQueueIntegrityAudit = (): DrQueueIntegrityAudit => ({
  queued: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  orphan: 0,
  recovered: 0,
  reclaimed: 0,
  duplicate: 0,
  corrupted: 0,
  repaired: 0,
});

import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";

const DEFAULT_LEASE_MS = 4 * 60 * 60 * 1000;
const DEFAULT_HEARTBEAT_STALE_MS = 2 * 60 * 1000;
const DEFAULT_MAX_LOCK_ATTEMPTS = 50;

export const resolveDrWorkerLeaseMs = (): number => {
  const fromLock = process.env.DR_JOB_LOCK_TTL_MS;
  const fromWorker = process.env.DR_WORKER_LEASE_MS;
  const raw = fromWorker ?? fromLock;
  if (!raw) return DEFAULT_LEASE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LEASE_MS;
};

export const resolveDrWorkerHeartbeatStaleMs = (): number => {
  const raw = process.env.DR_WORKER_HEARTBEAT_STALE_MS;
  if (!raw) return DEFAULT_HEARTBEAT_STALE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HEARTBEAT_STALE_MS;
};

export const resolveDrWorkerMaxLockAttempts = (): number => {
  const raw = process.env.DR_WORKER_MAX_LOCK_ATTEMPTS;
  if (!raw) return DEFAULT_MAX_LOCK_ATTEMPTS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_LOCK_ATTEMPTS;
};

export const createDrWorkerId = (): string => {
  const host = process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "local";
  return `dr-worker-${host}-${process.pid}`;
};

const buildLeaseExpiresAt = (from = Date.now()): Date =>
  new Date(from + resolveDrWorkerLeaseMs());

export type DrWorkerLockInspect = {
  recordId: string;
  status?: string;
  jobPhase?: string;
  workerId?: string;
  lockedAt?: string;
  heartbeatAt?: string;
  leaseExpiresAt?: string;
  lockIsHeld: boolean;
  lockIsStale: boolean;
  lockIsValid: boolean;
  rejectionReason?: string;
};

const isHeartbeatStale = (heartbeatAt?: Date | null, now = Date.now()): boolean => {
  if (!heartbeatAt) return true;
  return heartbeatAt.getTime() < now - resolveDrWorkerHeartbeatStaleMs();
};

const isLeaseExpired = (leaseExpiresAt?: Date | null, now = Date.now()): boolean => {
  if (!leaseExpiresAt) return true;
  return leaseExpiresAt.getTime() < now;
};

export const inspectDrWorkerJobLock = async (
  recordId: string,
  requestingWorkerId: string
): Promise<DrWorkerLockInspect | null> => {
  await connectDB();
  const row = await BackupRecord.findById(recordId)
    .select("status jobPhase workerId lockedAt heartbeatAt leaseExpiresAt")
    .lean();

  if (!row) {
    return {
      recordId,
      lockIsHeld: false,
      lockIsStale: false,
      lockIsValid: false,
      rejectionReason: "record_not_found",
    };
  }

  const now = Date.now();
  const heldWorkerId = row.workerId ? String(row.workerId) : undefined;
  const lockIsHeld = Boolean(heldWorkerId);
  const heartbeatStale = isHeartbeatStale(row.heartbeatAt ?? undefined, now);
  const leaseExpired = isLeaseExpired(row.leaseExpiresAt ?? undefined, now);
  const lockIsStale = lockIsHeld && (heartbeatStale || leaseExpired);
  const lockIsValid =
    lockIsHeld && !lockIsStale && heldWorkerId !== requestingWorkerId;

  let rejectionReason: string | undefined;
  if (row.status !== "pending") {
    rejectionReason = `status_${row.status}`;
  } else if (lockIsValid) {
    rejectionReason = "lock_held_by_other_worker";
  } else if (lockIsHeld && !lockIsStale && heldWorkerId === requestingWorkerId) {
    rejectionReason = "same_worker_reacquire";
  } else if (!lockIsHeld) {
    rejectionReason = "lock_available";
  } else if (lockIsStale) {
    rejectionReason = "lock_stale_reclaimable";
  }

  return {
    recordId,
    status: row.status,
    jobPhase: row.jobPhase,
    workerId: heldWorkerId,
    lockedAt: row.lockedAt ? new Date(row.lockedAt).toISOString() : undefined,
    heartbeatAt: row.heartbeatAt ? new Date(row.heartbeatAt).toISOString() : undefined,
    leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt).toISOString() : undefined,
    lockIsHeld,
    lockIsStale,
    lockIsValid,
    rejectionReason,
  };
};

export const reclaimStaleDrWorkerJobLock = async (
  recordId: string,
  requestingWorkerId: string
): Promise<boolean> => {
  const now = new Date();
  const staleBefore = new Date(Date.now() - resolveDrWorkerHeartbeatStaleMs());

  await connectDB();
  const existing = await BackupRecord.findById(recordId).select("workerId").lean();
  const previousWorkerId = existing?.workerId ? String(existing.workerId) : undefined;

  const result = await BackupRecord.findOneAndUpdate(
    {
      _id: recordId,
      status: "pending",
      workerId: { $exists: true, $nin: [null, ""] },
      $or: [
        { leaseExpiresAt: { $lt: now } },
        { heartbeatAt: { $lt: staleBefore } },
        { heartbeatAt: { $exists: false } },
      ],
    },
    {
      $unset: { workerId: "", lockedAt: "", leaseExpiresAt: "" },
      jobPhase: "queued",
    },
    { new: true }
  );

  if (result) {
    console.info("[DR] JOB_RECLAIMED", {
      jobId: recordId,
      requestingWorkerId,
      previousWorkerId,
    });
    return true;
  }

  return false;
};

export const acquireDrWorkerJobLock = async (
  recordId: string,
  workerId: string
): Promise<boolean> => {
  const inspection = await inspectDrWorkerJobLock(recordId, workerId);
  console.info("[DR] LOCK_ACQUIRE_ATTEMPT", {
    recordId,
    workerId,
    existingWorkerId: inspection?.workerId,
    heartbeatAt: inspection?.heartbeatAt,
    leaseExpiresAt: inspection?.leaseExpiresAt,
    jobPhase: inspection?.jobPhase,
    status: inspection?.status,
    lockIsHeld: inspection?.lockIsHeld,
    lockIsStale: inspection?.lockIsStale,
    lockIsValid: inspection?.lockIsValid,
    decision: inspection?.rejectionReason,
  });

  if (inspection?.lockIsValid) {
    console.warn("[DR] LOCK_ACQUIRE_REJECTED", {
      recordId,
      workerId,
      reason: "lock_held_by_other_worker",
      existingWorkerId: inspection.workerId,
      heartbeatAt: inspection.heartbeatAt,
      leaseExpiresAt: inspection.leaseExpiresAt,
    });
    return false;
  }

  if (inspection?.lockIsStale) {
    await reclaimStaleDrWorkerJobLock(recordId, workerId);
  }

  const now = new Date();
  const leaseExpiresAt = buildLeaseExpiresAt(now.getTime());
  const staleBefore = new Date(Date.now() - resolveDrWorkerHeartbeatStaleMs());

  await connectDB();
  const result = await BackupRecord.findOneAndUpdate(
    {
      _id: recordId,
      status: "pending",
      $or: [
        { workerId: { $exists: false } },
        { workerId: null },
        { workerId: "" },
        { workerId },
        {
          workerId: { $exists: true, $nin: [null, ""] },
          $or: [
            { leaseExpiresAt: { $lt: now } },
            { heartbeatAt: { $lt: staleBefore } },
            { heartbeatAt: { $exists: false } },
          ],
        },
      ],
    },
    {
      workerId,
      lockedAt: now,
      heartbeatAt: now,
      leaseExpiresAt,
      jobPhase: "starting",
    },
    { new: true }
  );

  if (!result) {
    const after = await inspectDrWorkerJobLock(recordId, workerId);
    console.warn("[DR] LOCK_ACQUIRE_REJECTED", {
      recordId,
      workerId,
      reason: after?.rejectionReason ?? "atomic_acquire_failed",
      existingWorkerId: after?.workerId,
      heartbeatAt: after?.heartbeatAt,
      leaseExpiresAt: after?.leaseExpiresAt,
      jobPhase: after?.jobPhase,
      status: after?.status,
    });
    return false;
  }

  console.info("[DR] LOCK_ACQUIRED", { jobId: recordId, workerId, leaseExpiresAt });
  return true;
};

export const releaseDrWorkerJobLock = async (
  recordId: string,
  workerId: string
): Promise<void> => {
  await connectDB();
  await BackupRecord.findOneAndUpdate(
    { _id: recordId, workerId },
    {
      $unset: { workerId: "", lockedAt: "", leaseExpiresAt: "" },
    }
  );
  console.info("[DR] LOCK_RELEASED", { jobId: recordId, workerId });
};

export const renewDrWorkerJobLease = async (
  recordId: string,
  workerId: string
): Promise<boolean> => {
  const now = new Date();
  const leaseExpiresAt = buildLeaseExpiresAt(now.getTime());

  await connectDB();
  const result = await BackupRecord.findOneAndUpdate(
    { _id: recordId, workerId, status: "pending" },
    { heartbeatAt: now, leaseExpiresAt },
    { new: true }
  );

  if (!result) {
    console.warn("[DR] LEASE_EXPIRED", { jobId: recordId, workerId });
    return false;
  }

  console.info("[DR] LEASE_RENEWED", { jobId: recordId, workerId, leaseExpiresAt });
  return true;
};

export const touchDrWorkerJobLock = async (
  recordId: string,
  workerId: string
): Promise<void> => {
  await renewDrWorkerJobLease(recordId, workerId);
};

export const computeDrWorkerLockBusyBackoffMs = (attempts: number): number => {
  const baseMs = 5_000;
  const maxMs = 120_000;
  const exponent = Math.min(Math.max(attempts - 1, 0), 6);
  return Math.min(maxMs, baseMs * 2 ** exponent);
};

const LOCK_BUSY_ERROR_PREFIX = "LOCK_BUSY:";

export const parseDrWorkerLockBusyAttempts = (lastError?: string | null): number => {
  if (!lastError?.startsWith(LOCK_BUSY_ERROR_PREFIX)) return 0;
  const match = lastError.match(/^LOCK_BUSY:(\d+):/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const formatDrWorkerLockBusyError = (attempts: number, detail: string): string =>
  `${LOCK_BUSY_ERROR_PREFIX}${attempts}:${detail}`;

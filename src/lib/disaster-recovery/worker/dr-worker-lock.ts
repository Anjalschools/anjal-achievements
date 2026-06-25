import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";

const DEFAULT_LEASE_MS = 4 * 60 * 60 * 1000;

export const resolveDrWorkerLeaseMs = (): number => {
  const fromLock = process.env.DR_JOB_LOCK_TTL_MS;
  const fromWorker = process.env.DR_WORKER_LEASE_MS;
  const raw = fromWorker ?? fromLock;
  if (!raw) return DEFAULT_LEASE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LEASE_MS;
};

export const createDrWorkerId = (): string => {
  const host = process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "local";
  return `dr-worker-${host}-${process.pid}`;
};

const buildLeaseExpiresAt = (from = Date.now()): Date =>
  new Date(from + resolveDrWorkerLeaseMs());

export const acquireDrWorkerJobLock = async (
  recordId: string,
  workerId: string
): Promise<boolean> => {
  const now = new Date();
  const leaseExpiresAt = buildLeaseExpiresAt(now.getTime());

  await connectDB();
  const result = await BackupRecord.findOneAndUpdate(
    {
      _id: recordId,
      status: "pending",
      $or: [
        { workerId: { $exists: false } },
        { workerId: null },
        { workerId: "" },
        { leaseExpiresAt: { $lt: now } },
        { leaseExpiresAt: { $exists: false } },
        { heartbeatAt: { $lt: new Date(Date.now() - resolveDrWorkerLeaseMs()) } },
        { workerId },
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

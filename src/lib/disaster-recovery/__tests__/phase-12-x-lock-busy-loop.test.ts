import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/mongodb", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/models/BackupRecord", () => ({
  default: {
    findByIdAndUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  enqueueBackupJob,
  getBackupJobQueue,
  resetBackupJobQueue,
  setBackupJobQueue,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { createInMemoryBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-memory-job-queue";
import { DrWorkerLockBusyError } from "@/lib/disaster-recovery/worker/dr-worker-errors";
import {
  computeDrWorkerLockBusyBackoffMs,
  parseDrWorkerLockBusyAttempts,
  resolveDrWorkerMaxLockAttempts,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";
import {
  getDrWorkerLastLockBusyBackoffMs,
  processNextBackupJob,
  resetDrPersistentWorkerState,
} from "@/lib/disaster-recovery/worker/dr-persistent-worker";

vi.mock("@/lib/disaster-recovery/worker/dr-worker", () => ({
  executeDrBackupWorkerJob: vi.fn(),
}));

import { executeDrBackupWorkerJob } from "@/lib/disaster-recovery/worker/dr-worker";

const validLockBusyInspection = {
  recordId: "blocked-job",
  lockIsHeld: true,
  lockIsStale: false,
  lockIsValid: true,
  rejectionReason: "lock_held_by_other_worker",
  workerId: "other-worker",
} as const;

describe("phase 12.x — DR lock-busy loop fix", () => {
  afterEach(() => {
    resetBackupJobQueue();
    resetDrPersistentWorkerState();
    vi.clearAllMocks();
    vi.useRealTimers();
    delete process.env.DR_WORKER_MAX_LOCK_ATTEMPTS;
  });

  beforeEach(() => {
    setBackupJobQueue(createInMemoryBackupJobQueue());
  });

  it("computes exponential backoff for lock-busy retries", () => {
    expect(computeDrWorkerLockBusyBackoffMs(1)).toBe(5_000);
    expect(computeDrWorkerLockBusyBackoffMs(2)).toBe(10_000);
    expect(computeDrWorkerLockBusyBackoffMs(4)).toBe(40_000);
    expect(computeDrWorkerLockBusyBackoffMs(10)).toBe(120_000);
  });

  it("postponeProcessing preserves dequeue attempts and blocks immediate re-dequeue", async () => {
    await enqueueBackupJob({
      recordId: "lock-job-1",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    const first = await getBackupJobQueue().dequeue("worker-test");
    expect(first?.attempts).toBe(1);

    const lockBusyAttempts = await getBackupJobQueue().postponeProcessing(
      "lock-job-1",
      "worker-test",
      60_000,
      "lock_held_by_other_worker"
    );
    expect(lockBusyAttempts).toBe(1);

    const immediate = await getBackupJobQueue().dequeue("worker-test");
    expect(immediate).toBeNull();

    expect(await getBackupJobQueue().has("lock-job-1")).toBe(true);
    expect(await getBackupJobQueue().size()).toBe(1);
    expect(await getBackupJobQueue().getLockBusyAttempts("lock-job-1")).toBe(1);
  });

  it("allows newer queued jobs to proceed while the head job is postponed", async () => {
    await enqueueBackupJob({
      recordId: "blocked-job",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });
    await enqueueBackupJob({
      recordId: "next-job",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    vi.mocked(executeDrBackupWorkerJob).mockRejectedValueOnce(
      new DrWorkerLockBusyError("blocked-job", { ...validLockBusyInspection, recordId: "blocked-job" })
    );

    const result = await processNextBackupJob("worker-test");
    expect(result).toBe("lock_busy");
    expect(getDrWorkerLastLockBusyBackoffMs()).toBeGreaterThanOrEqual(5_000);

    const item = await getBackupJobQueue().dequeue("worker-test");
    expect(item?.payload.recordId).toBe("next-job");
    expect(item?.attempts).toBe(1);
  });

  it("fails the job after bounded lock-busy attempts", async () => {
    vi.useFakeTimers();
    process.env.DR_WORKER_MAX_LOCK_ATTEMPTS = "2";

    await enqueueBackupJob({
      recordId: "max-lock-job",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    vi.mocked(executeDrBackupWorkerJob).mockRejectedValue(
      new DrWorkerLockBusyError("max-lock-job", {
        ...validLockBusyInspection,
        recordId: "max-lock-job",
      })
    );

    expect(await processNextBackupJob("worker-test")).toBe("lock_busy");
    expect(await getBackupJobQueue().has("max-lock-job")).toBe(true);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(await processNextBackupJob("worker-test")).toBe("lock_failed");
    expect(await getBackupJobQueue().has("max-lock-job")).toBe(false);
    expect(resolveDrWorkerMaxLockAttempts()).toBe(2);
  });

  it("parses lock-busy attempt counters from queue lastError", () => {
    expect(parseDrWorkerLockBusyAttempts(undefined)).toBe(0);
    expect(parseDrWorkerLockBusyAttempts("LOCK_BUSY:3:lock_held_by_other_worker")).toBe(3);
    expect(parseDrWorkerLockBusyAttempts("other error")).toBe(0);
  });
});

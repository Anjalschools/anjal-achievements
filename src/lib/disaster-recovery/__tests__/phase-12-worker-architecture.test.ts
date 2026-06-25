import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/mongodb", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import {
  enqueueBackupJob,
  getBackupJobQueue,
  resetBackupJobQueue,
  setBackupJobQueue,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { createInMemoryBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-memory-job-queue";
import {
  canTransitionDrWorkerPhase,
  mapInternalStageToWorkerPhase,
  normalizeWorkerPhaseForRead,
} from "@/lib/disaster-recovery/worker/dr-worker-state";
import {
  processNextBackupJob,
  resetDrPersistentWorkerState,
} from "@/lib/disaster-recovery/worker/dr-persistent-worker";

vi.mock("@/lib/disaster-recovery/worker/dr-worker", () => ({
  executeDrBackupWorkerJob: vi.fn().mockResolvedValue(undefined),
}));

import { executeDrBackupWorkerJob } from "@/lib/disaster-recovery/worker/dr-worker";

describe("phase 12.0/12.1 — DR worker architecture", () => {
  afterEach(() => {
    resetBackupJobQueue();
    resetDrPersistentWorkerState();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setBackupJobQueue(createInMemoryBackupJobQueue());
  });

  it("enqueues and dequeues jobs in FIFO order", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await enqueueBackupJob({
      recordId: "job-1",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });
    await enqueueBackupJob({
      recordId: "job-2",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    expect(await getBackupJobQueue().size()).toBe(2);
    expect(await getBackupJobQueue().list()).toEqual(["job-1", "job-2"]);
    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] QUEUE_PERSISTED",
      expect.objectContaining({ jobId: "job-1" })
    );

    const first = await getBackupJobQueue().dequeue("worker-test");
    expect(first?.payload.recordId).toBe("job-1");
    expect(infoSpy).toHaveBeenCalledWith(
      "[DR] QUEUE_DEQUEUED",
      expect.objectContaining({ jobId: "job-1" })
    );
  });

  it("enforces deterministic worker state transitions", () => {
    expect(canTransitionDrWorkerPhase("queued", "starting")).toBe(true);
    expect(canTransitionDrWorkerPhase("queued", "completed")).toBe(false);
    expect(canTransitionDrWorkerPhase("exporting", "uploading")).toBe(true);
    expect(mapInternalStageToWorkerPhase("object-export")).toBe("exporting");
    expect(normalizeWorkerPhaseForRead("complete")).toBe("completed");
  });

  it("processes queued jobs via persistent worker loop helper", async () => {
    await enqueueBackupJob({
      recordId: "worker-job-1",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    const processed = await processNextBackupJob("worker-test");
    expect(processed).toBe(true);
    expect(executeDrBackupWorkerJob).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ recordId: "worker-job-1" }) }),
      "worker-test"
    );
    expect(await getBackupJobQueue().size()).toBe(0);
  });

  it("acks completed jobs in persistent queue", async () => {
    await enqueueBackupJob({
      recordId: "ack-job-1",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    await processNextBackupJob("worker-test");
    expect(await getBackupJobQueue().has("ack-job-1")).toBe(false);
  });
});

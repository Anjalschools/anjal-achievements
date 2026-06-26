import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/mongodb", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/models/BackupRecord", () => ({
  default: {
    findByIdAndUpdate: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  },
}));

import {
  enqueueBackupJob,
  getBackupJobQueue,
  resetBackupJobQueue,
  setBackupJobQueue,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { createInMemoryBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-memory-job-queue";
import { DrWorkerOrphanQueueError } from "@/lib/disaster-recovery/worker/dr-worker-errors";
import {
  processNextBackupJob,
  resetDrPersistentWorkerState,
} from "@/lib/disaster-recovery/worker/dr-persistent-worker";

vi.mock("@/lib/disaster-recovery/worker/dr-worker", () => ({
  executeDrBackupWorkerJob: vi.fn(),
}));

import { executeDrBackupWorkerJob } from "@/lib/disaster-recovery/worker/dr-worker";

describe("phase 12.1.Z — terminal orphan queue handling", () => {
  afterEach(() => {
    resetBackupJobQueue();
    resetDrPersistentWorkerState();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setBackupJobQueue(createInMemoryBackupJobQueue());
  });

  it("fails orphan queue entries terminally without infinite retry", async () => {
    await enqueueBackupJob({
      recordId: "orphan-job",
      input: {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: "user-1",
      },
    });

    vi.mocked(executeDrBackupWorkerJob).mockRejectedValueOnce(
      new DrWorkerOrphanQueueError("orphan-job", "backup_record_missing")
    );

    const result = await processNextBackupJob("worker-test");
    expect(result).toBe("terminal_failed");
    expect(await getBackupJobQueue().has("orphan-job")).toBe(false);
    expect(await getBackupJobQueue().size()).toBe(0);
  });
});

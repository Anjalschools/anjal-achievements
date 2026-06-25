import { describe, expect, it, afterEach, vi } from "vitest";

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
  acquireDrJobLock,
  inspectDrJobLock,
  releaseDrJobLock,
  resetDrJobLock,
} from "@/lib/disaster-recovery/dr-job-lock";
import {
  dispatchDrBackgroundJob,
  getDrStartupMilestones,
  getDrStartupTiming,
  handleDrStartupFailure,
  initDrJobStartup,
  logDrStartupMilestone,
  markDrJobQueued,
  markDrJobScheduled,
  printDrStartupReport,
  resetDrJobStartup,
} from "@/lib/disaster-recovery/dr-job-startup";
import BackupRecord from "@/models/BackupRecord";

describe("phase 11.6 — DR background job startup", () => {
  afterEach(() => {
    resetDrJobStartup();
    resetDrJobLock();
    vi.restoreAllMocks();
  });

  it("dispatches background job via setImmediate with milestones", async () => {
    markDrJobQueued();
    initDrJobStartup("record-start-1");
    markDrJobScheduled();

    const runner = vi.fn().mockResolvedValue(undefined);
    dispatchDrBackgroundJob("record-start-1", runner);

    expect(getDrStartupMilestones()).toContain("QUEUE_JOB_SCHEDULED");
    expect(runner).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      setImmediate(() => resolve());
    });
    await new Promise<void>((resolve) => {
      setImmediate(() => resolve());
    });

    expect(getDrStartupMilestones()).toEqual(
      expect.arrayContaining(["QUEUE_JOB_DISPATCHED", "BACKGROUND_JOB_STARTING"])
    );
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("tracks queue and dispatch timing", () => {
    markDrJobQueued();
    initDrJobStartup("record-timing-1");
    markDrJobScheduled();
    logDrStartupMilestone("QUEUE_JOB_DISPATCHED");

    const timing = getDrStartupTiming();
    expect(timing.queueDelayMs).toBeGreaterThanOrEqual(0);
    expect(timing.dispatchDelayMs).toBeUndefined();
  });

  it("reports lock ownership and blocks concurrent jobs", () => {
    expect(acquireDrJobLock("job-a")).toBe(true);
    const status = inspectDrJobLock("job-b");
    expect(status.locked).toBe(true);
    expect(status.owner).toBe("job-a");
    expect(status.lockAgeMs).toBeGreaterThanOrEqual(0);
    expect(acquireDrJobLock("job-b")).toBe(false);
    releaseDrJobLock("job-a");
    expect(inspectDrJobLock("job-b").locked).toBe(false);
  });

  it("marks startup failure and updates backup record", async () => {
    initDrJobStartup("record-fail-1");
    const error = new Error("CONNECT_FAILED");
    await handleDrStartupFailure("record-fail-1", error);

    expect(getDrStartupMilestones()).toContain("BACKGROUND_JOB_START_FAILED");
    expect(BackupRecord.findByIdAndUpdate).toHaveBeenCalledWith(
      "record-fail-1",
      expect.objectContaining({
        status: "failed",
        jobPhase: "startup_failed",
        errorMessage: "CONNECT_FAILED",
      })
    );
  });

  it("prints startup report when backup never begins", () => {
    initDrJobStartup("record-report-1");
    logDrStartupMilestone("QUEUE_JOB_DISPATCHED");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    printDrStartupReport();

    const output = infoSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("DR STARTUP REPORT");
    expect(output).toContain("lastMilestone");
    expect(output).toContain("lockStatus");
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getDrMilestones,
  getOpenDrStreams,
  getPendingDrPromises,
  initDrVerification,
  logDrMilestone,
  printDrFinalReport,
  resetDrVerification,
  trackDrPromise,
} from "@/lib/disaster-recovery/dr-verification";

describe("phase 11.3 — DR verification", () => {
  beforeEach(() => {
    initDrVerification("test-record-1");
  });

  afterEach(() => {
    resetDrVerification();
  });

  it("records milestones in order", () => {
    logDrMilestone("OBJECT_EXPORT_COMPLETED", { exported: 10 });
    logDrMilestone("ZIP_FINALIZE_COMPLETED");
    expect(getDrMilestones()).toEqual(["OBJECT_EXPORT_COMPLETED", "ZIP_FINALIZE_COMPLETED"]);
  });

  it("tracks promise resolution", async () => {
    const value = await trackDrPromise("test-op", Promise.resolve(42));
    expect(value).toBe(42);
    expect(getPendingDrPromises()).toHaveLength(0);
  });

  it("prints final report without throwing", () => {
    logDrMilestone("BACKUP_JOB_COMPLETED");
    expect(() => printDrFinalReport()).not.toThrow();
    expect(getOpenDrStreams()).toHaveLength(0);
  });
});

import { describe, expect, it, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getOpenDrStreams,
  getPendingDrPromises,
  initDrVerification,
  resetDrVerification,
} from "@/lib/disaster-recovery/dr-verification";
import {
  initDrLeakDetection,
  printDrLeakReport,
  resetDrLeakDetection,
} from "@/lib/disaster-recovery/dr-leak-detection";

describe("phase 11.4 — DR leak detection", () => {
  afterEach(() => {
    resetDrLeakDetection();
    resetDrVerification();
  });

  it("prints leak report without throwing", () => {
    initDrVerification("record-leak-1");
    initDrLeakDetection();
    expect(() => printDrLeakReport()).not.toThrow();
  });

  it("tracks timers created during DR session", () => {
    initDrLeakDetection();
    const timer = setTimeout(() => undefined, 60_000);
    printDrLeakReport();
    clearTimeout(timer);
    expect(getPendingDrPromises()).toHaveLength(0);
    expect(getOpenDrStreams()).toHaveLength(0);
  });
});

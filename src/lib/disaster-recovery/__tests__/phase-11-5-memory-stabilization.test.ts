import { describe, expect, it, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  captureDrStack,
  shouldCaptureDrStacks,
} from "@/lib/disaster-recovery/dr-diag-policy";
import {
  getDrLeakRegistryCounts,
  initDrLeakDetection,
  resetDrLeakDetection,
} from "@/lib/disaster-recovery/dr-leak-detection";
import {
  getDrVerificationRegistryCounts,
  initDrVerification,
  resetDrVerification,
  trackDrPromise,
} from "@/lib/disaster-recovery/dr-verification";

describe("phase 11.5 — DR memory stabilization", () => {
  afterEach(() => {
    resetDrLeakDetection();
    resetDrVerification();
    delete process.env.DR_CAPTURE_STACKS;
  });

  it("does not capture stacks unless DR_CAPTURE_STACKS=true", () => {
    expect(shouldCaptureDrStacks()).toBe(false);
    expect(captureDrStack()).toBeUndefined();

    process.env.DR_CAPTURE_STACKS = "true";
    expect(shouldCaptureDrStacks()).toBe(true);
    const stack = captureDrStack();
    expect(stack).toBeDefined();
    expect(stack!.split("\n").length).toBeLessThanOrEqual(6);
  });

  it("removes tracked promises after settlement", async () => {
    initDrVerification("record-mem-1");
    let resolveFn: (value: number) => void = () => undefined;
    const pending = new Promise<number>((resolve) => {
      resolveFn = resolve;
    });

    const tracked = trackDrPromise("mem-op", pending);
    expect(getDrVerificationRegistryCounts().activePromises).toBe(1);

    resolveFn(1);
    await tracked;
    expect(getDrVerificationRegistryCounts().activePromises).toBe(0);
  });

  it("removes timers when cleared", async () => {
    initDrLeakDetection();
    const timer = setTimeout(() => undefined, 60_000);
    expect(getDrLeakRegistryCounts().activeTimers).toBeGreaterThan(0);
    clearTimeout(timer);
    expect(getDrLeakRegistryCounts().activeTimers).toBe(0);
  });

  it("removes timers after timeout callback executes", async () => {
    initDrLeakDetection();
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 5);
    });
    expect(getDrLeakRegistryCounts().activeTimers).toBe(0);
  });
});

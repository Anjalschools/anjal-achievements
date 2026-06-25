import { describe, expect, it, afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DR_MAX_TRACKED_ASYNC_RESOURCES } from "@/lib/disaster-recovery/dr-diag-policy";
import {
  emitDeferredRegistryOverflowWarning,
  getDrRegistryOverflowState,
  isDrAsyncHookEnabled,
  isDrInternalLogging,
  logDrRegistryLimit,
  recordDrRegistryOverflow,
  resetDrDiagGuard,
  setDrAsyncHookEnabled,
} from "@/lib/disaster-recovery/dr-diag-guard";
import {
  __drLeakHookTestInternals,
  initDrLeakDetection,
  isDrLeakHookEnabled,
  printDrLeakReport,
  resetDrLeakDetection,
} from "@/lib/disaster-recovery/dr-leak-detection";

describe("phase 11.6.A — async_hooks recursive logging guard", () => {
  afterEach(() => {
    resetDrLeakDetection();
    resetDrDiagGuard();
    vi.restoreAllMocks();
  });

  it("Test 1 — hook init never logs", () => {
    initDrLeakDetection();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    for (let i = 0; i < 5_000; i += 1) {
      __drLeakHookTestInternals.onAsyncHookInit(i, "PROMISE", 0);
    }

    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("Test 2 — overflow never logs while hook is enabled", () => {
    initDrLeakDetection();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (let i = 0; i < DR_MAX_TRACKED_ASYNC_RESOURCES + 2_000; i += 1) {
      __drLeakHookTestInternals.onAsyncHookInit(i, "PROMISE", 0);
    }

    const overflowCalls = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes("REGISTRY_LIMIT")
    );
    expect(overflowCalls).toHaveLength(0);
    expect(getDrRegistryOverflowState().detected).toBe(true);
    expect(getDrRegistryOverflowState().count).toBeGreaterThan(0);
  });

  it("Test 3 — hook init allocates no Promise", () => {
    initDrLeakDetection();
    let promiseConstructed = false;
    const OriginalPromise = global.Promise;
    class TrackingPromise extends OriginalPromise {
      constructor(...args: ConstructorParameters<typeof Promise>) {
        promiseConstructed = true;
        super(...args);
      }
    }
    vi.stubGlobal("Promise", TrackingPromise);

    try {
      for (let i = 0; i < 1_000; i += 1) {
        __drLeakHookTestInternals.onAsyncHookInit(i, "PROMISE", 0);
      }
      expect(promiseConstructed).toBe(false);
    } finally {
      vi.stubGlobal("Promise", OriginalPromise);
    }
  });

  it("Test 4 — hook init allocates no Timer", () => {
    initDrLeakDetection();
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const setImmediateSpy = vi.spyOn(global, "setImmediate");

    for (let i = 0; i < 1_000; i += 1) {
      __drLeakHookTestInternals.onAsyncHookInit(i, "PROMISE", 0);
    }

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(setImmediateSpy).not.toHaveBeenCalled();
  });

  it("Test 5 — hook init does not construct AsyncResource", () => {
    initDrLeakDetection();
    const { AsyncResource } = require("node:async_hooks") as typeof import("node:async_hooks");
    const asyncResourceSpy = vi.spyOn(AsyncResource.prototype, "runInAsyncScope");

    for (let i = 0; i < 1_000; i += 1) {
      __drLeakHookTestInternals.onAsyncHookInit(i, "PROMISE", 0);
    }

    expect(asyncResourceSpy).not.toHaveBeenCalled();
  });

  it("Test 6 — 100,000 async resources complete without recursion", async () => {
    initDrLeakDetection();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (let i = 0; i < 100_000; i += 1) {
      __drLeakHookTestInternals.onAsyncHookInit(i + 1, "PROMISE", 0);
      __drLeakHookTestInternals.onAsyncHookDestroy(i + 1);
    }

    const overflowCalls = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes("REGISTRY_LIMIT")
    );
    expect(overflowCalls).toHaveLength(0);
  });

  it("Test 7 — registry overflow does not recurse", () => {
    initDrLeakDetection();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    setDrAsyncHookEnabled(true);
    for (let i = 0; i < 10_000; i += 1) {
      logDrRegistryLimit("asyncResources", DR_MAX_TRACKED_ASYNC_RESOURCES);
    }

    expect(warnSpy).not.toHaveBeenCalled();
    expect(getDrRegistryOverflowState().count).toBe(10_000);

    emitDeferredRegistryOverflowWarning();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(isDrAsyncHookEnabled()).toBe(true);

    setDrAsyncHookEnabled(false);
  });

  it("Test 8 — leak report runs only after hook.disable()", async () => {
    initDrLeakDetection();
    expect(isDrLeakHookEnabled()).toBe(true);

    let hookEnabledDuringReport = true;
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      hookEnabledDuringReport = isDrLeakHookEnabled();
    });

    await printDrLeakReport();

    expect(infoSpy).toHaveBeenCalled();
    expect(hookEnabledDuringReport).toBe(false);
  });

  it("internal logging guard suppresses nested registry warnings", () => {
    resetDrDiagGuard();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    setDrAsyncHookEnabled(false);
    recordDrRegistryOverflow("timers");
    emitDeferredRegistryOverflowWarning();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(isDrInternalLogging()).toBe(false);
  });
});

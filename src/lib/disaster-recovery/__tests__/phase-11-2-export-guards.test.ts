import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DrOperationTimeoutError,
  withDrAbortTimeout,
  withDrTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import { DrExportWatchdog } from "@/lib/disaster-recovery/dr-export-watchdog";

describe("phase 11.2.D — export hang guards (timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("withDrTimeout rejects when a promise never settles", async () => {
    const pending = new Promise<void>(() => undefined);
    const raced = withDrTimeout(pending, 50, "testOp", { objectKey: "obj-1" });
    const expectation = expect(raced).rejects.toBeInstanceOf(DrOperationTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });

  it("withDrAbortTimeout aborts fetch signal on timeout", async () => {
    let capturedSignal: AbortSignal | undefined;
    const raced = withDrAbortTimeout(
      "fetchAbort",
      30,
      async (signal) => {
        capturedSignal = signal;
        return new Promise<string>(() => undefined);
      },
      { objectKey: "http/file.pdf" }
    );
    const expectation = expect(raced).rejects.toBeInstanceOf(DrOperationTimeoutError);
    await vi.advanceTimersByTimeAsync(30);
    await expectation;
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("DrExportWatchdog invokes onStall after idle threshold", async () => {
    const onStall = vi.fn();
    const watchdog = new DrExportWatchdog({ stallMs: 60_000, onStall });
    watchdog.start();
    watchdog.touch({ processedObjects: 10, lastArchivePath: "objects/r2/a.pdf" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(onStall.mock.calls[0]?.[0]?.lastArchivePath).toBe("objects/r2/a.pdf");
    watchdog.stop();
  });
});

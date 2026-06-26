import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { validateDrQueuePayload } from "@/lib/disaster-recovery/worker/dr-queue-payload-validation";
import {
  classifyDrWorkerFailure,
  computeDrRetryBackoffMs,
} from "@/lib/disaster-recovery/worker/dr-worker-retry-classification";
import {
  DrWorkerCorruptPayloadError,
  DrWorkerLockBusyError,
  DrWorkerOrphanQueueError,
} from "@/lib/disaster-recovery/worker/dr-worker-errors";

describe("phase 12.1.Z — DR worker hardening", () => {
  it("rejects corrupted queue payloads", () => {
    expect(validateDrQueuePayload(undefined).valid).toBe(false);
    expect(validateDrQueuePayload({ recordId: "x", input: {} as never }).valid).toBe(false);
    expect(
      validateDrQueuePayload({
        recordId: "job-1",
        input: {
          moduleId: "unknown-module" as never,
          storageProvider: "r2",
          createdByUserId: "user-1",
        },
      }).valid
    ).toBe(false);
    expect(
      validateDrQueuePayload({
        recordId: "job-1",
        input: {
          moduleId: "full",
          storageProvider: "r2",
          createdByUserId: "user-1",
        },
      }).valid
    ).toBe(true);
  });

  it("classifies terminal and retryable failures centrally", () => {
    expect(classifyDrWorkerFailure(new DrWorkerOrphanQueueError("job-1")).retryable).toBe(false);
    expect(
      classifyDrWorkerFailure(new DrWorkerCorruptPayloadError("job-1", "input_missing")).retryable
    ).toBe(false);
    expect(
      classifyDrWorkerFailure(
        new DrWorkerLockBusyError("job-1", {
          recordId: "job-1",
          lockIsHeld: true,
          lockIsStale: false,
          lockIsValid: true,
          rejectionReason: "record_not_found",
        })
      ).category
    ).toBe("terminal");
    expect(classifyDrWorkerFailure(new Error("MongoNetworkError: connection reset")).retryable).toBe(
      true
    );
    expect(classifyDrWorkerFailure(new Error("NoSuchKey: object missing")).retryable).toBe(false);
    expect(classifyDrWorkerFailure(new Error("AccessDenied: invalid credentials")).retryable).toBe(
      false
    );
  });

  it("computes bounded exponential retry backoff", () => {
    expect(computeDrRetryBackoffMs(1)).toBe(10_000);
    expect(computeDrRetryBackoffMs(3)).toBe(40_000);
    expect(computeDrRetryBackoffMs(10)).toBe(300_000);
  });
});

import { finished } from "stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DR_EXPORT_WATCHDOG_STALL_MS } from "@/lib/disaster-recovery/dr-async-timeout";
import { createRobustCloudinaryDownloadStream } from "@/lib/disaster-recovery/dr-cloudinary-download";
import {
  PIPELINE_DEADLOCK_CODE,
  classifyMissingAssetReason,
  isPipelineDeadlockFailure,
} from "@/lib/disaster-recovery/dr-cloudinary-export-policy";
import {
  getMissingAssetRecords,
  resetMissingAssetRegistry,
} from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";
import { createResilientCloudinaryDownloadStream } from "@/lib/disaster-recovery/dr-cloudinary-resilient-download";

const buildResponse = (input: {
  body?: ReadableStream<Uint8Array> | null;
  contentLength?: string;
}): Response => {
  const headers = new Headers();
  if (input.contentLength !== undefined) {
    headers.set("content-length", input.contentLength);
  }
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    redirected: false,
    url: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
    headers,
    body: input.body ?? null,
  } as Response;
};

describe("phase DR.ZIP.21 — cloudinary pipeline deadlock recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMissingAssetRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("classifies pipeline deadlock separately from download stalls", () => {
    expect(isPipelineDeadlockFailure(new Error(PIPELINE_DEADLOCK_CODE))).toBe(true);
    expect(
      isPipelineDeadlockFailure(new Error(`CLOUDINARY_MISSING_ASSET:${PIPELINE_DEADLOCK_CODE}`))
    ).toBe(true);
    expect(classifyMissingAssetReason(new Error(PIPELINE_DEADLOCK_CODE))).toBe("pipeline_deadlock");
    expect(classifyMissingAssetReason(new Error("DOWNLOAD_DATA_STALLED"))).toBe("download_stalled");
  });

  it("detects PIPELINE_DEADLOCK when output backpressure stalls the reader pump", async () => {
    const largeChunk = Buffer.alloc(32 * 1024);
    const fetchImpl = vi.fn(async () =>
      buildResponse({
        contentLength: String(largeChunk.byteLength * 2),
        body: new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.enqueue(new Uint8Array(largeChunk));
          },
        }),
      })
    );

    const stream = await createRobustCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/sample.jpg",
      storageKey: "cloudinary://image/sample",
      signal: new AbortController().signal,
      fetchImpl,
    });

    stream.pause();

    const finishedPromise = finished(stream);
    const rejection = expect(finishedPromise).rejects.toThrow(/PIPELINE_DEADLOCK/);

    await vi.advanceTimersByTimeAsync(DR_EXPORT_WATCHDOG_STALL_MS + 1);
    await vi.runAllTimersAsync();
    await rejection;
  });

  it("records missing asset with stream_pipeline stage via resilient wrapper", async () => {
    const largeChunk = Buffer.alloc(32 * 1024);
    const fetchImpl = vi.fn(async () =>
      buildResponse({
        contentLength: String(largeChunk.byteLength * 2),
        body: new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.enqueue(new Uint8Array(largeChunk));
          },
        }),
      })
    );

    const stream = await createResilientCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/sample.jpg",
      storageKey: "cloudinary://image/sample",
      publicId: "sample",
      signal: new AbortController().signal,
      fetchImpl,
    });

    stream.pause();

    const finishedPromise = finished(stream);
    const rejection = expect(finishedPromise).rejects.toThrow(/CLOUDINARY_MISSING_ASSET:PIPELINE_DEADLOCK/);

    await vi.advanceTimersByTimeAsync(DR_EXPORT_WATCHDOG_STALL_MS + 1);
    await vi.runAllTimersAsync();
    await rejection;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const records = getMissingAssetRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.failureReason).toBe("pipeline_deadlock");
    expect(records[0]?.stage).toBe("stream_pipeline");
    expect(records[0]?.errorCode).toBe(PIPELINE_DEADLOCK_CODE);
  });
});

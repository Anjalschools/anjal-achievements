import { Readable } from "stream";
import { finished } from "stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DR_EXPORT_WATCHDOG_STALL_MS } from "@/lib/disaster-recovery/dr-async-timeout";
import {
  classifyMissingAssetReason,
  isPermanentCloudinaryFailure,
  isTransientCloudinaryFailure,
} from "@/lib/disaster-recovery/dr-cloudinary-export-policy";
import {
  getMissingAssetRecords,
  resetMissingAssetRegistry,
} from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";
import { createResilientCloudinaryDownloadStream } from "@/lib/disaster-recovery/dr-cloudinary-resilient-download";

const buildResponse = (input: {
  body?: ReadableStream<Uint8Array> | null;
  status?: number;
}): Response => {
  const headers = new Headers();
  const status = input.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    redirected: false,
    url: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
    headers,
    body: input.body ?? null,
    text: async () => (status === 404 ? "not found" : ""),
  } as Response;
};

describe("phase DR.ZIP.19 — cloudinary export policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMissingAssetRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("classifies permanent and transient failures", () => {
    expect(isPermanentCloudinaryFailure(new Error("CLOUDINARY_DOWNLOAD_FAILED:404"))).toBe(true);
    expect(isTransientCloudinaryFailure(new Error("DOWNLOAD_DATA_STALLED"))).toBe(true);
    expect(isPermanentCloudinaryFailure(new Error("DOWNLOAD_DATA_STALLED"))).toBe(false);
    expect(classifyMissingAssetReason(new Error("DOWNLOAD_DATA_STALLED"))).toBe("download_stalled");
    expect(classifyMissingAssetReason(new Error("CLOUDINARY_DOWNLOAD_FAILED:404"))).toBe("not_found");
    expect(classifyMissingAssetReason(new Error("PIPELINE_DEADLOCK"))).toBe("pipeline_deadlock");
  });

  it("retries transient stalls and succeeds on attempt 2", async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        return buildResponse({
          body: new ReadableStream<Uint8Array>({
            start() {
              // stall
            },
          }),
        });
      }
      const payload = Buffer.from("cloudinary-bytes");
      return buildResponse({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(payload));
            controller.close();
          },
        }),
      });
    });

    const stream = await createResilientCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/sample.jpg",
      storageKey: "cloudinary://image/sample",
      publicId: "sample",
      signal: new AbortController().signal,
      fetchImpl,
    });

    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    const finishedPromise = finished(stream);
    await vi.advanceTimersByTimeAsync(DR_EXPORT_WATCHDOG_STALL_MS + 1);
    await vi.runAllTimersAsync();
    await finishedPromise;

    expect(attempts).toBe(2);
    expect(Buffer.concat(chunks).toString()).toBe("cloudinary-bytes");
    expect(getMissingAssetRecords()).toHaveLength(0);
  });

  it("records missing asset after retries are exhausted", async () => {
    const fetchImpl = vi.fn(async () =>
      buildResponse({
        body: new ReadableStream<Uint8Array>({
          start() {
            // stall forever
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

    const finishedPromise = finished(stream);
    const rejection = expect(finishedPromise).rejects.toThrow(/CLOUDINARY_MISSING_ASSET/);

    await vi.advanceTimersByTimeAsync((DR_EXPORT_WATCHDOG_STALL_MS + 1) * 3);
    await vi.runAllTimersAsync();
    await rejection;

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const records = getMissingAssetRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.attempts).toBe(3);
    expect(records[0]?.errorCode).toMatch(/DOWNLOAD_NO_FIRST_BYTE/);
  });

  it("does not retry permanent not-found failures", async () => {
    const fetchImpl = vi.fn(async () => buildResponse({ status: 404, body: null }));

    const stream = await createResilientCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/missing.jpg",
      storageKey: "cloudinary://image/missing",
      publicId: "missing",
      signal: new AbortController().signal,
      fetchImpl,
    });

    await expect(finished(stream)).rejects.toThrow(/CLOUDINARY_MISSING_ASSET/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getMissingAssetRecords()[0]?.failureReason).toBe("not_found");
    expect(getMissingAssetRecords()[0]?.attempts).toBe(1);
  });
});

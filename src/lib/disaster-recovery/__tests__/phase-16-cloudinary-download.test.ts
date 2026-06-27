import { Readable } from "stream";
import { finished } from "stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DR_EXPORT_WATCHDOG_STALL_MS } from "@/lib/disaster-recovery/dr-async-timeout";
import { createRobustCloudinaryDownloadStream } from "@/lib/disaster-recovery/dr-cloudinary-download";

const buildResponse = (input: {
  body?: ReadableStream<Uint8Array> | null;
  status?: number;
  contentLength?: string;
}): Response => {
  const headers = new Headers();
  if (input.contentLength !== undefined) {
    headers.set("content-length", input.contentLength);
  }
  return {
    ok: input.status === undefined || input.status === 200,
    status: input.status ?? 200,
    redirected: false,
    url: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
    headers,
    body: input.body ?? null,
  } as Response;
};

const toWebStream = (chunks: Buffer[]): ReadableStream<Uint8Array> => {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      if (!chunk) {
        controller.close();
        return;
      }
      index += 1;
      controller.enqueue(new Uint8Array(chunk));
    },
  });
};

describe("phase DR.ZIP.16 — robust cloudinary download", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completes a download when content-length matches bytes received", async () => {
    const payload = Buffer.from("cloudinary-bytes");
    const fetchImpl = vi.fn(async () =>
      buildResponse({
        contentLength: String(payload.byteLength),
        body: toWebStream([payload]),
      })
    );

    const stream = await createRobustCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/sample.jpg",
      storageKey: "cloudinary://image/sample",
      signal: new AbortController().signal,
      fetchImpl,
    });

    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    await finished(stream);
    expect(Buffer.concat(chunks).toString()).toBe("cloudinary-bytes");
  });

  it("fails with DOWNLOAD_INCOMPLETE when content-length does not match", async () => {
    const payload = Buffer.from("short");
    const fetchImpl = vi.fn(async () =>
      buildResponse({
        contentLength: "100",
        body: toWebStream([payload]),
      })
    );

    const stream = await createRobustCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/sample.jpg",
      storageKey: "cloudinary://image/sample",
      signal: new AbortController().signal,
      fetchImpl,
    });

    await expect(finished(stream)).rejects.toThrow(/DOWNLOAD_INCOMPLETE/);
  });

  it("fails with DOWNLOAD_STREAM_STALLED when no data arrives", async () => {
    const stalledBody = new ReadableStream<Uint8Array>({
      start() {
        // Never enqueue or close.
      },
    });
    const fetchImpl = vi.fn(async () =>
      buildResponse({
        body: stalledBody,
      })
    );

    const streamPromise = createRobustCloudinaryDownloadStream({
      downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      objectKey: "objects/cloudinary/sample.jpg",
      storageKey: "cloudinary://image/sample",
      signal: new AbortController().signal,
      fetchImpl,
    });

    const stream = await streamPromise;
    const finishedPromise = finished(stream);
    const rejection = expect(finishedPromise).rejects.toThrow(/DOWNLOAD_STREAM_STALLED/);

    await vi.advanceTimersByTimeAsync(DR_EXPORT_WATCHDOG_STALL_MS + 1);
    await rejection;
  });
});

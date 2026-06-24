import { createHash } from "crypto";
import { PassThrough, Readable } from "stream";
import { finished } from "stream/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashContent } from "@/lib/backup/backup-manifest";
import { createZipArchiveWriter } from "@/lib/backup/backup-zip";
import {
  runSequentialObjectStreamExport,
  type ExportedObjectStreamPayload,
} from "@/lib/disaster-recovery/dr-export-streaming";
import { createHashingObjectStream } from "@/lib/disaster-recovery/dr-stream-utils";
import { exportStorageObjectStream } from "@/lib/disaster-recovery/object-export";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

const buildInlineEntry = (index: number, sizeBytes = 4): StorageManifestEntry => {
  const payload = Buffer.alloc(sizeBytes, index % 256);
  return {
    id: `entry-${index}`,
    provider: "inline",
    storageKey: `data:application/octet-stream;base64,${payload.toString("base64")}`,
    archivePath: `objects/inline/file-${index}.bin`,
    fileSize: sizeBytes,
    sourceCollection: "achievements",
    sourceDocumentId: String(index),
    sourceField: "attachments",
    status: "pending",
  };
};

const createChunkedReadable = (totalBytes: number, chunkSize = 64 * 1024): Readable => {
  let offset = 0;
  return new Readable({
    read() {
      if (offset >= totalBytes) {
        this.push(null);
        return;
      }
      const size = Math.min(chunkSize, totalBytes - offset);
      const chunk = Buffer.alloc(size, offset % 256);
      offset += size;
      this.push(chunk);
    },
  });
};

describe("phase 11.2.B — true end-to-end streaming export", () => {
  it("computes checksums while streaming without materializing full buffers", async () => {
    const entry = buildInlineEntry(1, 16);
    const { stream, completed } = await exportStorageObjectStream(entry);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks);
    const finalized = await completed;

    expect(finalized.checksum).toBe(hashContent(content));
    expect(finalized.fileSize).toBe(16);
    expect(finalized.status).toBe("exported");
  });

  it(
    "keeps maxLiveStreams <= 1 during sequential stream export",
    async () => {
    const entries = Array.from({ length: 2501 }, (_, index) => buildInlineEntry(index));

    let maxLiveStreams = 0;
    let liveStreams = 0;

    const result = await runSequentialObjectStreamExport({
      entries,
      exportObjectStream: exportStorageObjectStream,
      onObjectReady: async ({ stream }) => {
        liveStreams += 1;
        maxLiveStreams = Math.max(maxLiveStreams, liveStreams);
        const sink = new PassThrough();
        const consume = finished(sink);
        sink.on("data", () => undefined);
        stream.pipe(sink);
        await consume;
        liveStreams -= 1;
      },
    });

    expect(result.manifestEntries).toHaveLength(2501);
    expect(result.failures).toHaveLength(0);
    expect(maxLiveStreams).toBeLessThanOrEqual(1);
  },
    30_000
  );

  it("handles large chunked objects without retaining multiple streams", async () => {
    const largeSizes = [5 * 1024 * 1024, 12 * 1024 * 1024, 20 * 1024 * 1024];
    const entries = largeSizes.map((sizeBytes, index) => ({
      ...buildInlineEntry(index, sizeBytes),
      storageKey: `data:application/octet-stream;base64,${Buffer.alloc(1).toString("base64")}`,
    }));

    let maxLiveStreams = 0;
    let liveStreams = 0;
    const memorySamples: number[] = [];

    const exportLargeObjectStream = async (
      entry: StorageManifestEntry
    ): Promise<ExportedObjectStreamPayload> => {
      const source = createChunkedReadable(entry.fileSize || 0);
      const { stream, completed } = createHashingObjectStream(entry, source);
      return {
        stream,
        completed,
        archivePath: entry.archivePath,
      };
    };

    const result = await runSequentialObjectStreamExport({
      entries,
      exportObjectStream: async (entry) => {
        const payload = await exportLargeObjectStream(entry);
        return payload;
      },
      onObjectReady: async ({ stream }) => {
        liveStreams += 1;
        maxLiveStreams = Math.max(maxLiveStreams, liveStreams);
        memorySamples.push(process.memoryUsage().heapUsed);
        const sink = new PassThrough();
        const consume = finished(sink);
        sink.on("data", () => undefined);
        stream.pipe(sink);
        await consume;
        liveStreams -= 1;
      },
    });

    expect(result.manifestEntries).toHaveLength(3);
    expect(maxLiveStreams).toBeLessThanOrEqual(1);
    const firstSample = memorySamples[0] || 0;
    const lastSample = memorySamples[memorySamples.length - 1] || 0;
    expect(lastSample).toBeLessThan(firstSample + 80 * 1024 * 1024);
    expect(result.bytesExported).toBe(largeSizes.reduce((sum, size) => sum + size, 0));
  });

  it("appends stream sources to zip writer with backpressure", async () => {
    const output = new PassThrough();
    const writer = await createZipArchiveWriter(output);
    const appendSpy = vi.spyOn(writer, "append");

    const entry = buildInlineEntry(1, 32);
    const { stream, completed } = await exportStorageObjectStream(entry);
    await writer.append(stream, { name: entry.archivePath });
    const finalized = await completed;

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(finalized.checksum).toBeTruthy();
    output.destroy();
  });

  it("records stream export failures without stopping the pipeline", async () => {
    const result = await runSequentialObjectStreamExport({
      entries: [buildInlineEntry(1), buildInlineEntry(2), buildInlineEntry(3)],
      exportObjectStream: async (entry) => {
        if (entry.id === "entry-2") {
          throw new Error("STREAM_OPEN_FAILED");
        }
        return exportStorageObjectStream(entry).then((payload) => ({
          stream: payload.stream,
          completed: payload.completed,
          archivePath: entry.archivePath,
        }));
      },
      onObjectReady: async ({ stream }) => {
        const sink = new PassThrough();
        const consume = finished(sink);
        sink.on("data", () => undefined);
        stream.pipe(sink);
        await consume;
      },
    });

    expect(result.manifestEntries).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.id).toBe("entry-2");
  });
});

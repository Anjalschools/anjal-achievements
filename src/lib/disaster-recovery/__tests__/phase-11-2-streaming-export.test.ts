import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runSequentialObjectExport } from "@/lib/disaster-recovery/dr-export-streaming";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

const buildInlineEntry = (index: number): StorageManifestEntry => ({
  id: `entry-${index}`,
  provider: "inline",
  storageKey: `data:text/plain;base64,${Buffer.from(`file-${index}`).toString("base64")}`,
  archivePath: `objects/inline/file-${index}.bin`,
  sourceCollection: "achievements",
  sourceDocumentId: String(index),
  sourceField: "attachments",
  status: "pending",
});

describe("phase 11.2 — streaming object export", () => {
  it("does not accumulate exported buffers in a result array", async () => {
    const retainedBuffers: Buffer[] = [];
    const exportObject = vi.fn(async (entry: StorageManifestEntry) => ({
      entry: { ...entry, status: "exported" as const, checksum: "abc", fileSize: 4 },
      content: Buffer.from("test"),
    }));

    const result = await runSequentialObjectExport({
      entries: [buildInlineEntry(1), buildInlineEntry(2)],
      exportObject,
      onObjectReady: async ({ content }) => {
        retainedBuffers.push(content);
        retainedBuffers.length = 0;
      },
    });

    expect(result.manifestEntries).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(exportObject).toHaveBeenCalledTimes(2);
    expect(retainedBuffers).toHaveLength(0);
    expect(result).not.toHaveProperty("exported");
  });

  it("exports more than 2500 mixed provider entries sequentially", async () => {
    const entries: StorageManifestEntry[] = Array.from({ length: 2501 }, (_, index) => ({
      ...buildInlineEntry(index),
      provider: index % 2 === 0 ? "r2" : "cloudinary",
      storageKey: index % 2 === 0 ? `achievements/attachments/2025/${index}.pdf` : `cloudinary://image/p${index}`,
      archivePath:
        index % 2 === 0
          ? `objects/r2/achievements/attachments/2025/${index}.pdf`
          : `objects/cloudinary/p${index}`,
    }));

    let maxLiveBuffers = 0;
    let liveBuffers = 0;

    const result = await runSequentialObjectExport({
      entries,
      exportObject: async (entry) => {
        liveBuffers += 1;
        maxLiveBuffers = Math.max(maxLiveBuffers, liveBuffers);
        const payload = {
          entry: { ...entry, status: "exported" as const, checksum: "x", fileSize: 3 },
          content: Buffer.from("bin"),
        };
        return payload;
      },
      onObjectReady: async () => {
        liveBuffers -= 1;
      },
      onProgress: (progress) => {
        if (progress.processed % 500 === 0) {
          expect(progress.remaining).toBe(entries.length - progress.processed);
        }
      },
    });

    expect(result.manifestEntries).toHaveLength(2501);
    expect(result.failures).toHaveLength(0);
    expect(maxLiveBuffers).toBeLessThanOrEqual(1);
  });

  it("records failures without stopping the export stream", async () => {
    const result = await runSequentialObjectExport({
      entries: [buildInlineEntry(1), buildInlineEntry(2), buildInlineEntry(3)],
      exportObject: async (entry) => {
        if (entry.id === "entry-2") {
          throw new Error("DOWNLOAD_FAILED");
        }
        return {
          entry: { ...entry, status: "exported" as const, checksum: "x", fileSize: 1 },
          content: Buffer.from("a"),
        };
      },
      onObjectReady: async () => undefined,
    });

    expect(result.manifestEntries).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.id).toBe("entry-2");
  });
});

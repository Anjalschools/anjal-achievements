import { PassThrough, Readable } from "stream";
import { finished } from "stream/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDrArchiveStreamRegistry,
  createHashingObjectStream,
} from "@/lib/disaster-recovery/dr-stream-utils";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

const buildInlineEntry = (): StorageManifestEntry => ({
  id: "entry-1",
  provider: "inline",
  storageKey: `data:application/octet-stream;base64,${Buffer.from("abcd").toString("base64")}`,
  archivePath: "objects/inline/file-1.bin",
  fileSize: 4,
  sourceCollection: "achievements",
  sourceDocumentId: "1",
  sourceField: "attachments",
  status: "pending",
});

describe("phase DR.ZIP.14 — archive stream registry", () => {
  it("throws STREAM_NOT_COMPLETED_BEFORE_FINALIZE when a producer is incomplete", () => {
    const registry = createDrArchiveStreamRegistry();
    const stream = new PassThrough();
    registry.registerArchiveStream(stream, "objects/inline/file-1.bin");

    expect(() => registry.assertAllProducersCompleted()).toThrow(
      /STREAM_NOT_COMPLETED_BEFORE_FINALIZE/
    );
  });

  it("dispose clears all registry entries", () => {
    const registry = createDrArchiveStreamRegistry();
    const stream = new PassThrough();
    registry.registerArchiveStream(stream, "objects/inline/file-1.bin");
    expect(registry.getSummary().total).toBe(1);

    registry.dispose();

    expect(registry.getSummary()).toEqual({
      total: 0,
      completed: 0,
      incomplete: 0,
      lastIncompleteEntry: null,
    });
  });

  it("marks producer completion only after the hashing pipeline finishes", async () => {
    const registry = createDrArchiveStreamRegistry();
    const entry = buildInlineEntry();
    const source = Readable.from(Buffer.from("abcd"));
    const { stream, completed } = createHashingObjectStream(entry, source);
    registry.registerArchiveStream(stream, entry.archivePath);

    const sink = new PassThrough();
    const consume = finished(sink);
    sink.on("data", () => undefined);
    stream.pipe(sink);
    const finalized = await completed;
    await consume;

    registry.markProducerCompleted(stream);
    expect(finalized.status).toBe("exported");
    expect(() => registry.assertAllProducersCompleted()).not.toThrow();
    expect(registry.getSummary()).toEqual({
      total: 1,
      completed: 1,
      incomplete: 0,
      lastIncompleteEntry: null,
    });
  });
});

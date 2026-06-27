import { PassThrough } from "stream";
import { finished } from "stream/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getMissingAssetRecords,
  resetMissingAssetRegistry,
} from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";
import { getDrJobContext, resetDrJobContext, updateDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import {
  attachPipelineProgressWatchdog,
  PIPELINE_PROGRESS_STALL_CODE,
  PIPELINE_WATCHDOG_TIMEOUT_MS,
} from "@/lib/disaster-recovery/dr-pipeline-progress-watchdog";
import { createDrArchiveStreamRegistry } from "@/lib/disaster-recovery/dr-stream-utils";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

const buildEntry = (overrides: Partial<StorageManifestEntry> = {}): StorageManifestEntry => ({
  id: "entry-1",
  provider: "cloudinary",
  storageKey: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
  archivePath: "objects/cloudinary/sample.jpg",
  sourceCollection: "achievements",
  sourceDocumentId: "doc-1",
  sourceField: "image",
  status: "pending",
  ...overrides,
});

describe("phase DR.ZIP.22 — pipeline progress watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMissingAssetRegistry();
    resetDrJobContext({ archivePointer: 0, totalObjects: 3, processedObjects: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const muteStreamErrors = (...streams: PassThrough[]): void => {
    streams.forEach((stream) => {
      stream.on("error", () => undefined);
    });
  };

  it("completes normally when archive progress continues", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    const rawCompleted = Promise.resolve(buildEntry({ status: "exported", fileSize: 4 }));

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 5_000,
      pollMs: 500,
    });

    source.write(Buffer.from("abcd"));
    archive.write(Buffer.from("abcd"));
    source.end();
    archive.end();

    await expect(handle.completed).resolves.toMatchObject({ status: "exported" });
    expect(handle.getState()).toBe("COMPLETED");
    expect(getMissingAssetRecords()).toHaveLength(0);
    handle.stop();
  });

  it("allows pause then resume without treating it as a stall", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    let resolveRaw: (entry: StorageManifestEntry) => void = () => undefined;
    const rawCompleted = new Promise<StorageManifestEntry>((resolve) => {
      resolveRaw = resolve;
    });

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 5_000,
      pollMs: 500,
    });

    source.write(Buffer.from("aa"));
    archive.write(Buffer.from("aa"));
    source.pause();

    await vi.advanceTimersByTimeAsync(3_000);
    expect(["PAUSED", "PROGRESSING"]).toContain(handle.getState());
    expect(getMissingAssetRecords()).toHaveLength(0);

    source.resume();
    archive.write(Buffer.from("bb"));
    resolveRaw(buildEntry({ status: "exported", fileSize: 4 }));

    await expect(handle.completed).resolves.toMatchObject({ status: "exported" });
    handle.stop();
  });

  it("skips a stalled pipeline after watchdog timeout when source is paused", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    const registry = createDrArchiveStreamRegistry();
    registry.registerArchiveStream(archive, "objects/cloudinary/sample.jpg");

    const rawCompleted = new Promise<StorageManifestEntry>(() => {
      // intentionally never resolves
    });

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      streamRegistry: registry,
      timeoutMs: 5_000,
      pollMs: 500,
    });

    source.write(Buffer.from("abcd"));
    archive.write(Buffer.from("abcd"));
    source.pause();

    const completedPromise = handle.completed;
    await vi.advanceTimersByTimeAsync(5_500);
    await vi.runOnlyPendingTimersAsync();

    await expect(completedPromise).resolves.toMatchObject({
      status: "missing",
      errorMessage: PIPELINE_PROGRESS_STALL_CODE,
    });
    expect(handle.getState()).toBe("SKIPPED");
    expect(source.destroyed).toBe(true);
    expect(archive.destroyed).toBe(true);
    expect(registry.getSummary().incomplete).toBe(0);

    const records = getMissingAssetRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.failureReason).toBe("pipeline_progress_stalled");
    expect(records[0]?.stage).toBe("pipeline_watchdog");
  });

  it("does not reset stall timer when only download-side bytes increase", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    const rawCompleted = new Promise<StorageManifestEntry>(() => undefined);

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 8_000,
      pollMs: 500,
    });

    archive.write(Buffer.from("aa"));
    source.pause();

    await vi.advanceTimersByTimeAsync(3_000);
    source.write(Buffer.from("more-download-bytes"));
    await vi.advanceTimersByTimeAsync(3_000);
    expect(getMissingAssetRecords()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(3_000);
    await expect(handle.completed).resolves.toMatchObject({
      status: "missing",
      errorMessage: PIPELINE_PROGRESS_STALL_CODE,
    });
    handle.stop();
  });

  it("treats archive pointer movement as progress", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    const rawCompleted = new Promise<StorageManifestEntry>(() => undefined);

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      getArchivePointer: () => getDrJobContext().archivePointer,
      timeoutMs: 5_000,
      pollMs: 500,
    });

    archive.write(Buffer.from("aa"));
    source.pause();

    await vi.advanceTimersByTimeAsync(4_000);
    updateDrJobContext({ archivePointer: 4096 });
    await vi.advanceTimersByTimeAsync(4_000);

    expect(getMissingAssetRecords()).toHaveLength(0);
    expect(["PAUSED", "PROGRESSING"]).toContain(handle.getState());
    handle.stop();
  });

  it("prevents duplicate cleanup when stall handler runs once", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    const rawCompleted = new Promise<StorageManifestEntry>(() => undefined);

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 2_000,
      pollMs: 200,
    });

    archive.write(Buffer.from("aa"));
    source.pause();

    const completedPromise = handle.completed;
    await vi.advanceTimersByTimeAsync(5_000);
    await completedPromise;

    expect(getMissingAssetRecords()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(getMissingAssetRecords()).toHaveLength(1);
    handle.stop();
  });

  it("uses the configured default watchdog timeout constant", () => {
    expect(PIPELINE_WATCHDOG_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
  });

  it("rejects when the raw completed promise rejects before stall", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    const rawCompleted = Promise.reject(new Error("RAW_PIPELINE_FAILED"));

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 5_000,
      pollMs: 500,
    });

    source.on("error", () => undefined);
    archive.on("error", () => undefined);

    await expect(handle.completed).rejects.toThrow(/RAW_PIPELINE_FAILED/);
    handle.stop();
  });

  it("handles stalled archive output after partial write", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    archive.on("data", () => {
      archive.pause();
    });

    const rawCompleted = new Promise<StorageManifestEntry>(() => undefined);
    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 3_000,
      pollMs: 300,
    });

    source.write(Buffer.from("chunk"));
    source.pause();
    archive.write(Buffer.from("partial"));

    await vi.advanceTimersByTimeAsync(3_500);
    await expect(handle.completed).resolves.toMatchObject({
      status: "missing",
      errorMessage: PIPELINE_PROGRESS_STALL_CODE,
    });
    handle.stop();
  });

  it("continues after multiple consecutive stalled assets", async () => {
    const runOne = async (suffix: string) => {
      const source = new PassThrough();
      const archive = new PassThrough();
      muteStreamErrors(source, archive);
      const rawCompleted = new Promise<StorageManifestEntry>(() => undefined);
      const handle = attachPipelineProgressWatchdog({
        entry: buildEntry({ id: suffix, archivePath: `objects/cloudinary/${suffix}.jpg` }),
        sourceStream: source,
        archiveStream: archive,
        rawCompleted,
        timeoutMs: 1_000,
        pollMs: 200,
      });
      archive.write(Buffer.from("x"));
      source.pause();
      await vi.advanceTimersByTimeAsync(1_200);
      await handle.completed;
      handle.stop();
    };

    await runOne("a");
    await runOne("b");
    await runOne("c");

    expect(getMissingAssetRecords()).toHaveLength(3);
  });

  it("does not leave archive stream pending after skip", async () => {
    const source = new PassThrough();
    const archive = new PassThrough();
    muteStreamErrors(source, archive);
    const rawCompleted = new Promise<StorageManifestEntry>(() => undefined);

    const handle = attachPipelineProgressWatchdog({
      entry: buildEntry(),
      sourceStream: source,
      archiveStream: archive,
      rawCompleted,
      timeoutMs: 1_000,
      pollMs: 200,
    });

    archive.write(Buffer.from("aa"));
    source.pause();

    await vi.advanceTimersByTimeAsync(1_500);
    await handle.completed;

    await expect(finished(archive).catch(() => undefined)).resolves.toBeUndefined();
    handle.stop();
  });
});

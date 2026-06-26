import { PassThrough, Readable } from "stream";
import { EventEmitter } from "events";
import { finished } from "stream/promises";
import unzipper from "unzipper";
import { hashContent, serializeManifest, type BackupManifest } from "@/lib/backup/backup-manifest";
import { resolveCollectionFileName } from "@/lib/backup/backup-constants";
import {
  DR_ARCHIVE_FINALIZE_TIMEOUT_MS,
  DR_STREAM_DRAIN_TIMEOUT_MS,
  withDrTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import { logDrObjectDiag } from "@/lib/disaster-recovery/dr-stream-lifecycle";
import { logDrArchiveAppendFailed } from "@/lib/disaster-recovery/dr-object-stream-diagnostics";
import { finishedWithTimeout, isNodeReadableStream } from "@/lib/disaster-recovery/dr-stream-utils";

const loadZipArchive = async () => {
  const { ZipArchive } = await import(/* webpackIgnore: true */ "archiver");
  return ZipArchive;
};

export type BackupPackageEntry = {
  collectionKey: string;
  fileName: string;
  content: Buffer;
  recordCount: number;
  checksum: string;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export type BackupPackageExtraFile = {
  path: string;
  content: Buffer;
};

export type ZipPipelineDiagnostics = {
  phase: string;
  at: string;
  archivePointer: number;
  queueLength: number;
  queueIdle: boolean;
  entriesQueued: number;
  entriesProcessed: number;
  pending: number;
  archiveFinalized: boolean;
  archiveFinalizing: boolean;
  archiveAborted: boolean;
  outputDestroyed: boolean;
  outputWritableNeedDrain: boolean;
  outputWritableLength: number;
  outputReadableLength: number;
  outputWritableEnded: boolean;
  outputWritableFinished: boolean;
  outputReadableEnded: boolean;
  outputClosed: boolean;
  archivePaused: boolean;
};

type ArchiverWithInternals = EventEmitter & {
  pointer: () => number;
  append: (source: Buffer | Readable, options: { name: string }) => void;
  pipe: (destination: PassThrough) => void;
  finalize: () => Promise<void>;
  resume?: () => void;
  isPaused?: () => boolean;
  _queue?: {
    idle: () => boolean;
    length: () => number;
    drain: (callback: () => void) => void;
  };
  _entriesCount?: number;
  _entriesProcessedCount?: number;
  _pending?: number;
  _state?: {
    finalize?: boolean;
    finalizing?: boolean;
    finalized?: boolean;
    aborted?: boolean;
  };
};

const readZipPipelineDiagnostics = (
  archive: ArchiverWithInternals,
  output: PassThrough,
  phase: string
): ZipPipelineDiagnostics => ({
  phase,
  at: new Date().toISOString(),
  archivePointer: archive.pointer(),
  queueLength: archive._queue?.length() ?? -1,
  queueIdle: archive._queue?.idle() ?? false,
  entriesQueued: archive._entriesCount ?? -1,
  entriesProcessed: archive._entriesProcessedCount ?? -1,
  pending: archive._pending ?? -1,
  archiveFinalized: Boolean(archive._state?.finalized),
  archiveFinalizing: Boolean(archive._state?.finalizing),
  archiveAborted: Boolean(archive._state?.aborted),
  outputDestroyed: output.destroyed,
  outputWritableNeedDrain: output.writableNeedDrain,
  outputWritableLength: output.writableLength,
  outputReadableLength: output.readableLength,
  outputWritableEnded: output.writableEnded,
  outputWritableFinished: output.writableFinished,
  outputReadableEnded: output.readableEnded,
  outputClosed: Boolean((output as { closed?: boolean }).closed),
  archivePaused: Boolean(archive.isPaused?.()),
});

const logZipPipelineDiagnostics = (
  archive: ArchiverWithInternals,
  output: PassThrough,
  phase: string,
  extra: Record<string, unknown> = {}
): void => {
  console.info("[DR] ZIP_PIPELINE_STATE", {
    ...readZipPipelineDiagnostics(archive, output, phase),
    ...extra,
  });
};

const assertZipAppendSource = (source: Buffer | Readable): void => {
  if (Buffer.isBuffer(source)) return;
  if (isNodeReadableStream(source)) return;
  throw new Error(
    `ZIP_APPEND_INVALID_SOURCE:expected Buffer or Node.js Readable,got ${source === null ? "null" : typeof source}`
  );
};

export type ZipArchiveWriter = {
  append: (source: Buffer | Readable, options: { name: string }) => Promise<void>;
  finalize: () => Promise<void>;
  pointer: () => number;
  logPipelineDiagnostics: (phase: string, extra?: Record<string, unknown>) => void;
  getArchiveState?: () => { pointer: number; aborted?: boolean };
  getArchiveDiagnostics?: () => {
    archivePointer: number;
    archiveAborted?: boolean;
    archiveDestroyed?: boolean;
    archiveReadableEnded?: boolean;
    archiveListeners: Record<string, number>;
    outputDestroyed?: boolean;
    outputReadableEnded?: boolean;
    outputWritableFinished?: boolean;
    outputClosed?: boolean;
    outputListeners: Record<string, number>;
    queueLength?: number;
    queueIdle?: boolean;
    entriesQueued?: number;
    entriesProcessed?: number;
    outputWritableNeedDrain?: boolean;
    outputWritableLength?: number;
  };
};

export const createZipArchiveWriter = async (output: PassThrough): Promise<ZipArchiveWriter> => {
  const ZipArchive = await loadZipArchive();
  const archive = new ZipArchive({ zlib: { level: 6 } }) as unknown as ArchiverWithInternals;
  let appendCount = 0;

  const listenerNames = ["error", "end", "finish", "close", "data", "drain", "entry", "progress"];
  const countListeners = (emitter: NodeJS.EventEmitter): Record<string, number> =>
    Object.fromEntries(listenerNames.map((name) => [name, emitter.listenerCount(name)]));

  archive.on("error", (error: unknown) => {
    logDrObjectDiag("Archive error", {
      pointer: archive.pointer(),
      message: error instanceof Error ? error.message : String(error),
    });
  });

  archive.on("entry", (data: { name?: string }) => {
    logDrObjectDiag("Archive entry", {
      pointer: archive.pointer(),
      name: data.name,
      entriesProcessed: archive._entriesProcessedCount,
      entriesQueued: archive._entriesCount,
    });
  });

  archive.on("progress", (progress: {
    entries?: { total?: number; processed?: number };
  }) => {
    logDrObjectDiag("Archive progress", {
      pointer: archive.pointer(),
      entriesTotal: progress.entries?.total,
      entriesProcessed: progress.entries?.processed,
    });
  });

  archive.on("finish", () => {
    logDrObjectDiag("Archive finish", { pointer: archive.pointer() });
  });

  archive.on("end", () => {
    logDrObjectDiag("Archive end", { pointer: archive.pointer() });
  });

  archive.pipe(output);

  output.on("pipe", (source: Readable) => {
    logDrObjectDiag("Output pipe", { sourceType: source.constructor.name });
  });

  output.on("unpipe", (source: Readable) => {
    logDrObjectDiag("Output unpipe", { sourceType: source.constructor.name });
  });

  output.on("finish", () => {
    logDrObjectDiag("Output finish", {
      writableFinished: output.writableFinished,
      readableEnded: output.readableEnded,
    });
  });

  output.on("close", () => {
    logDrObjectDiag("Output close", { destroyed: output.destroyed });
  });

  output.on("error", (error) => {
    logDrObjectDiag("Output error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  logZipPipelineDiagnostics(archive, output, "archive-created");

  return {
    logPipelineDiagnostics: (phase, extra = {}) => logZipPipelineDiagnostics(archive, output, phase, extra),
    append: async (source, options) => {
      assertZipAppendSource(source);

      appendCount += 1;
      const entryName = options.name;
      const shouldLog = appendCount % 100 === 0 || appendCount === 1;
      const appendContext = {
        provider: "zip" as const,
        archivePath: entryName,
        storageKey: entryName,
        streamName: "zip-append-drain",
      };

      logZipPipelineDiagnostics(archive, output, "append-before", {
        appendCount,
        entryName,
        sourceType: Buffer.isBuffer(source) ? "buffer" : "stream",
        sourceBytes: Buffer.isBuffer(source) ? source.byteLength : undefined,
      });

      if (shouldLog) {
        console.info("[DR] ZIP_APPEND_START", {
          count: appendCount,
          pointer: archive.pointer(),
          name: entryName,
        });
      }

      archive.append(source, options);

      if (isNodeReadableStream(source)) {
        try {
          await finishedWithTimeout(
            source as Readable,
            DR_STREAM_DRAIN_TIMEOUT_MS,
            "zipAppendDrain",
            { objectKey: entryName }
          );
        } catch (error) {
          logDrArchiveAppendFailed(appendContext, error);
          throw error;
        }
      }

      logZipPipelineDiagnostics(archive, output, "append-complete", {
        appendCount,
        entryName,
      });

      if (shouldLog) {
        console.info("[DR] ZIP_APPEND_END", {
          count: appendCount,
          pointer: archive.pointer(),
          name: entryName,
        });
      }
    },
    finalize: async () => {
      logZipPipelineDiagnostics(archive, output, "finalize-before");
      console.log("[DR] BEFORE archive.finalize (writer)");
      logDrObjectDiag("Finalize started", { pointer: archive.pointer() });

      let moduleSettled = false;
      const moduleFinalize = archive.finalize().then(() => {
        moduleSettled = true;
      });

      const outputDestroyedGuard = new Promise<void>((_, reject) => {
        const cleanup = (): void => {
          output.off("close", onClose);
          output.off("error", onError);
        };
        const onClose = (): void => {
          if (output.destroyed && !moduleSettled) {
            cleanup();
            reject(new Error("ARCHIVE_OUTPUT_DESTROYED_DURING_FINALIZE"));
          }
        };
        const onError = (err: Error): void => {
          if (!moduleSettled) {
            cleanup();
            reject(err);
          }
        };
        output.on("close", onClose);
        output.on("error", onError);
        void moduleFinalize.finally(cleanup);
      });

      await withDrTimeout(
        Promise.race([moduleFinalize, outputDestroyedGuard]),
        DR_ARCHIVE_FINALIZE_TIMEOUT_MS,
        "archiveFinalize"
      );
      logZipPipelineDiagnostics(archive, output, "finalize-after");
      logDrObjectDiag("Finalize finished", { pointer: archive.pointer() });
      console.log("[DR] AFTER archive.finalize (writer)", { pointer: archive.pointer() });
    },
    pointer: () => archive.pointer(),
    getArchiveState: () => ({
      pointer: archive.pointer(),
      aborted: Boolean(archive._state?.aborted),
    }),
    getArchiveDiagnostics: () => ({
      archivePointer: archive.pointer(),
      archiveAborted: Boolean(archive._state?.aborted),
      archiveDestroyed: Boolean((archive as { destroyed?: boolean }).destroyed),
      archiveReadableEnded: Boolean((archive as { readableEnded?: boolean }).readableEnded),
      archiveListeners: countListeners(archive as unknown as NodeJS.EventEmitter),
      outputDestroyed: output.destroyed,
      outputReadableEnded: output.readableEnded,
      outputWritableFinished: output.writableFinished,
      outputClosed: Boolean((output as { closed?: boolean }).closed),
      outputListeners: countListeners(output),
      queueLength: archive._queue?.length(),
      queueIdle: archive._queue?.idle(),
      entriesQueued: archive._entriesCount,
      entriesProcessed: archive._entriesProcessedCount,
      outputWritableNeedDrain: output.writableNeedDrain,
      outputWritableLength: output.writableLength,
    }),
  };
};

export const appendManifestAndCollectionsToZip = async (input: {
  writer: ZipArchiveWriter;
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
}): Promise<BackupManifest> => {
  const checksums = Object.fromEntries(
    input.entries.map((entry) => [entry.collectionKey, entry.checksum])
  );
  const manifestWithChecksums: BackupManifest = {
    ...input.manifest,
    checksums,
  };
  const manifestBuffer = Buffer.from(serializeManifest(manifestWithChecksums), "utf8");
  await input.writer.append(manifestBuffer, { name: "manifest.json" });
  for (const entry of input.entries) {
    await input.writer.append(entry.content, { name: entry.fileName });
  }
  return manifestWithChecksums;
};

export const buildZipFromEntries = async (input: {
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
  extraFiles?: BackupPackageExtraFile[];
}): Promise<Buffer> => {
  const checksums = Object.fromEntries(
    input.entries.map((entry) => [entry.collectionKey, entry.checksum])
  );
  const manifestWithChecksums: BackupManifest = {
    ...input.manifest,
    checksums,
  };
  const manifestBuffer = Buffer.from(serializeManifest(manifestWithChecksums), "utf8");

  const ZipArchive = await loadZipArchive();
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = new PassThrough();
  const zipPromise = streamToBuffer(output);

  archive.on("error", (error) => {
    output.destroy(error);
  });

  archive.pipe(output);
  archive.append(manifestBuffer, { name: "manifest.json" });
  for (const entry of input.entries) {
    archive.append(entry.content, { name: entry.fileName });
  }
  for (const extra of input.extraFiles || []) {
    archive.append(extra.content, { name: extra.path });
  }
  await archive.finalize();

  return zipPromise;
};

export type ExtractedBackupPackage = {
  manifest: BackupManifest;
  collections: Record<string, Buffer>;
  storageManifest?: Buffer;
  objects: Record<string, Buffer>;
};

export const extractBackupZipPackage = async (zipBuffer: Buffer): Promise<ExtractedBackupPackage> => {
  const directory = await unzipper.Open.buffer(zipBuffer);
  const manifestEntry = directory.files.find((file) => file.path === "manifest.json");
  if (!manifestEntry) {
    throw new Error("MANIFEST_MISSING");
  }

  const manifestRaw = (await manifestEntry.buffer()).toString("utf8");
  const manifest = JSON.parse(manifestRaw) as BackupManifest;

  const collections: Record<string, Buffer> = {};
  const objects: Record<string, Buffer> = {};
  let storageManifest: Buffer | undefined;

  for (const file of directory.files) {
    if (file.path === "storage-manifest.json") {
      storageManifest = await file.buffer();
      continue;
    }
    if (file.path.startsWith("objects/")) {
      objects[file.path] = await file.buffer();
      continue;
    }
    if (!file.path.startsWith("collections/") || !file.path.endsWith(".json")) continue;
    const mongoFileName = file.path.replace("collections/", "").replace(/\.json$/, "");
    collections[mongoFileName] = await file.buffer();
  }

  return { manifest, collections, storageManifest, objects };
};

export const createPackageEntry = (input: {
  collectionKey: string;
  content: Buffer;
  recordCount: number;
}): BackupPackageEntry => ({
  collectionKey: input.collectionKey,
  fileName: `collections/${resolveCollectionFileName(input.collectionKey)}`,
  content: input.content,
  recordCount: input.recordCount,
  checksum: hashContent(input.content),
});

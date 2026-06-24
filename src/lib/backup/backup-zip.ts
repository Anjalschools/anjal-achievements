import { PassThrough, Readable } from "stream";
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

export type ZipArchiveWriter = {
  append: (source: Buffer | Readable, options: { name: string }) => Promise<void>;
  finalize: () => Promise<void>;
  pointer: () => number;
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
  };
};

export const createZipArchiveWriter = async (output: PassThrough): Promise<ZipArchiveWriter> => {
  const ZipArchive = await loadZipArchive();
  const archive = new ZipArchive({ zlib: { level: 6 } });
  let appendCount = 0;

  archive.on("error", (error) => {
    output.destroy(error);
  });

  archive.pipe(output);

  const listenerNames = ["error", "end", "finish", "close", "data", "drain"];
  const countListeners = (emitter: NodeJS.EventEmitter): Record<string, number> =>
    Object.fromEntries(listenerNames.map((name) => [name, emitter.listenerCount(name)]));

  return {
    append: async (source, options) => {
      appendCount += 1;
      const shouldLog = appendCount % 100 === 0 || appendCount === 1;
      if (shouldLog) {
        console.info("[DR] ZIP_APPEND_START", {
          count: appendCount,
          pointer: archive.pointer(),
          name: options.name,
        });
      }

      archive.append(source, options);

      if (isNodeReadableStream(source)) {
        await finishedWithTimeout(
          source as Readable,
          DR_STREAM_DRAIN_TIMEOUT_MS,
          "zipAppendDrain",
          { objectKey: options.name }
        );
      }

      if (shouldLog) {
        console.info("[DR] ZIP_APPEND_END", {
          count: appendCount,
          pointer: archive.pointer(),
          name: options.name,
        });
      }
    },
    finalize: async () => {
      console.log("[DR] BEFORE archive.finalize (writer)");
      logDrObjectDiag("Finalize started", { pointer: archive.pointer() });
      await withDrTimeout(
        archive.finalize(),
        DR_ARCHIVE_FINALIZE_TIMEOUT_MS,
        "archiveFinalize"
      );
      logDrObjectDiag("Finalize finished", { pointer: archive.pointer() });
      console.log("[DR] AFTER archive.finalize (writer)", { pointer: archive.pointer() });
    },
    pointer: () => archive.pointer(),
    getArchiveState: () => ({
      pointer: archive.pointer(),
      aborted: Boolean((archive as { _aborting?: boolean })._aborting),
    }),
    getArchiveDiagnostics: () => ({
      archivePointer: archive.pointer(),
      archiveAborted: Boolean((archive as { _aborting?: boolean })._aborting),
      archiveDestroyed: Boolean((archive as { destroyed?: boolean }).destroyed),
      archiveReadableEnded: Boolean((archive as { readableEnded?: boolean }).readableEnded),
      archiveListeners: countListeners(archive),
      outputDestroyed: output.destroyed,
      outputReadableEnded: output.readableEnded,
      outputWritableFinished: output.writableFinished,
      outputClosed: Boolean((output as { closed?: boolean }).closed),
      outputListeners: countListeners(output),
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

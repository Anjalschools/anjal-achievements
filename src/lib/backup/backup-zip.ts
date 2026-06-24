import { PassThrough, Readable } from "stream";
import unzipper from "unzipper";
import { hashContent, serializeManifest, type BackupManifest } from "@/lib/backup/backup-manifest";
import { resolveCollectionFileName } from "@/lib/backup/backup-constants";

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
  append: (source: Buffer, options: { name: string }) => void;
  finalize: () => Promise<void>;
};

export const createZipArchiveWriter = async (output: PassThrough): Promise<ZipArchiveWriter> => {
  const ZipArchive = await loadZipArchive();
  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on("error", (error) => {
    output.destroy(error);
  });

  archive.pipe(output);

  return {
    append: (source, options) => {
      archive.append(source, options);
    },
    finalize: async () => {
      await archive.finalize();
    },
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
  input.writer.append(manifestBuffer, { name: "manifest.json" });
  for (const entry of input.entries) {
    input.writer.append(entry.content, { name: entry.fileName });
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

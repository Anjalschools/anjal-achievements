import "server-only";
import mongoose from "mongoose";
import { EJSON } from "bson";
import connectDB from "@/lib/mongodb";
import {
  BACKUP_EXPORT_BATCH_SIZE,
  resolveMongoCollectionName,
} from "@/lib/backup/backup-constants";
import type { BackupManifest } from "@/lib/backup/backup-manifest";
import {
  buildZipFromEntries,
  createPackageEntry,
  extractBackupZipPackage,
  type BackupPackageEntry,
  type ExtractedBackupPackage,
} from "@/lib/backup/backup-zip";

export { extractBackupZipPackage, type ExtractedBackupPackage };

export const exportCollectionDocuments = async (collectionKey: string): Promise<Buffer> => {
  await connectDB();
  const collectionName = resolveMongoCollectionName(collectionKey);
  const collection = mongoose.connection.collection(collectionName);
  const cursor = collection.find({}).batchSize(BACKUP_EXPORT_BATCH_SIZE);

  const lines: string[] = ["["];
  let first = true;

  for await (const doc of cursor) {
    const serialized = EJSON.stringify(doc);
    lines.push(first ? serialized : `,${serialized}`);
    first = false;
  }
  lines.push("]");

  if (!first) {
    return Buffer.from(`${lines.join("\n")}\n`, "utf8");
  }

  return Buffer.from("[]\n", "utf8");
};

export const countCollectionDocuments = async (collectionKey: string): Promise<number> => {
  await connectDB();
  const collectionName = resolveMongoCollectionName(collectionKey);
  return mongoose.connection.collection(collectionName).countDocuments({});
};

export const buildBackupZipPackage = async (input: {
  manifest: BackupManifest;
  collectionKeys: string[];
}): Promise<{ zipBuffer: Buffer; entries: BackupPackageEntry[] }> => {
  const entries: BackupPackageEntry[] = [];

  for (const collectionKey of input.collectionKeys) {
    const content = await exportCollectionDocuments(collectionKey);
    entries.push(
      createPackageEntry({
        collectionKey,
        content,
        recordCount: input.manifest.recordCounts[collectionKey] ?? 0,
      })
    );
  }

  const zipBuffer = await buildZipFromEntries({
    manifest: input.manifest,
    entries,
  });

  return { zipBuffer, entries };
};

export const parseCollectionBackupContent = (content: Buffer): Record<string, unknown>[] => {
  const raw = content.toString("utf8").trim();
  if (!raw || raw === "[]") return [];
  const parsed = EJSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("COLLECTION_JSON_INVALID");
  }
  return parsed as Record<string, unknown>[];
};

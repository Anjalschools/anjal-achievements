import { mkdir, stat, writeFile } from "fs/promises";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import {
  exportCollectionDocumentsToBsonFile,
  type CollectionDocumentCursor,
} from "@/lib/disaster-recovery-v2/database/export-collection-bson";

export type DatabaseExportDependencies = {
  ensureDirectory: (directoryPath: string) => Promise<void>;
  writeManifest: (manifestPath: string, manifest: unknown) => Promise<void>;
  listCollections: () => Promise<Array<{ name: string }>>;
  exportCollection: (input: {
    collectionName: string;
    outputPath: string;
  }) => Promise<{
    documentCount: number;
    sizeBytes: number;
    sha256: string;
    durationMs: number;
  }>;
};

export const createDefaultDatabaseExportDependencies = (): DatabaseExportDependencies => ({
  ensureDirectory: async (directoryPath: string) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeManifest: async (manifestPath: string, manifest: unknown) => {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  },
  listCollections: async () => {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MONGODB_CONNECTION_UNAVAILABLE");
    }
    return db.listCollections({}, { nameOnly: true }).toArray();
  },
  exportCollection: async ({ collectionName, outputPath }) => {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MONGODB_CONNECTION_UNAVAILABLE");
    }

    const collection = db.collection(collectionName);
    const batchSize = 512;

    return exportCollectionDocumentsToBsonFile({
      outputPath,
      statFile: (filePath) => stat(filePath),
      openCursor: async (): Promise<CollectionDocumentCursor> => {
        const cursor = collection.find({}).batchSize(batchSize);
        return {
          close: async () => {
            await cursor.close();
          },
          [Symbol.asyncIterator]: () => cursor[Symbol.asyncIterator]() as AsyncIterator<Record<string, unknown>>,
        };
      },
    });
  },
});

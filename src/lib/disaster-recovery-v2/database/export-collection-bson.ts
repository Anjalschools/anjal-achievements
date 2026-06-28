import { createWriteStream } from "fs";
import { finished } from "stream/promises";
import { serialize } from "bson";
import type { Writable } from "stream";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";

export type CollectionDocumentCursor = {
  close: () => Promise<void>;
  [Symbol.asyncIterator]: () => AsyncIterator<Record<string, unknown>>;
};

export type CollectionExportResult = {
  documentCount: number;
  sizeBytes: number;
  sha256: string;
  durationMs: number;
};

const writeBuffer = async (stream: Writable, chunk: Buffer): Promise<void> => {
  if (stream.write(chunk)) return;

  await new Promise<void>((resolve, reject) => {
    const onDrain = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const cleanup = (): void => {
      stream.off("drain", onDrain);
      stream.off("error", onError);
    };

    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
};

const writeBsonDocument = async (stream: Writable, document: Record<string, unknown>): Promise<void> => {
  const bsonDocument = serialize(document);
  const header = Buffer.alloc(4);
  header.writeInt32LE(bsonDocument.length, 0);
  await writeBuffer(stream, header);
  await writeBuffer(stream, Buffer.from(bsonDocument));
};

export const exportCollectionDocumentsToBsonFile = async (input: {
  outputPath: string;
  openCursor: () => Promise<CollectionDocumentCursor>;
  statFile: (filePath: string) => Promise<{ size: number }>;
}): Promise<CollectionExportResult> => {
  const startedAt = Date.now();
  let documentCount = 0;
  let cursor: CollectionDocumentCursor | null = null;
  const writeStream = createWriteStream(input.outputPath, { flags: "w" });

  try {
    cursor = await input.openCursor();

    for await (const document of cursor) {
      await writeBsonDocument(writeStream, document);
      documentCount += 1;
    }
  } finally {
    if (cursor) {
      await cursor.close();
      cursor = null;
    }

    writeStream.end();
    await finished(writeStream);
  }

  const sha256 = await computeFileSha256(input.outputPath);
  const fileStat = await input.statFile(input.outputPath);

  return {
    documentCount,
    sizeBytes: fileStat.size,
    sha256,
    durationMs: Date.now() - startedAt,
  };
};

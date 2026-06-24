import { createHash } from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export const isNodeReadableStream = (source: Buffer | Readable): source is Readable =>
  !Buffer.isBuffer(source) && typeof source.pipe === "function";

export const webBodyToNodeStream = (body: ReadableStream<Uint8Array>): Readable =>
  Readable.fromWeb(body as import("stream/web").ReadableStream);

export type HashingObjectStream = {
  stream: Readable;
  completed: Promise<StorageManifestEntry>;
};

export const createHashingObjectStream = (
  entry: StorageManifestEntry,
  sourceStream: Readable
): HashingObjectStream => {
  const hash = createHash("sha256");
  let byteLength = 0;

  let resolveCompleted!: (entry: StorageManifestEntry) => void;
  let rejectCompleted!: (error: Error) => void;
  const completed = new Promise<StorageManifestEntry>((resolve, reject) => {
    resolveCompleted = resolve;
    rejectCompleted = reject;
  });

  let settled = false;
  const settleCompleted = (finalizedEntry: StorageManifestEntry): void => {
    if (settled) return;
    settled = true;
    resolveCompleted(finalizedEntry);
  };
  const rejectWith = (error: Error): void => {
    if (settled) return;
    settled = true;
    rejectCompleted(error);
  };

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      byteLength += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      try {
        let errorMessage = entry.errorMessage;
        if (entry.fileSize && entry.fileSize > 0 && byteLength !== entry.fileSize) {
          errorMessage = `SIZE_MISMATCH:expected=${entry.fileSize},actual=${byteLength}`;
        }
        settleCompleted({
          ...entry,
          fileSize: byteLength,
          checksum: hash.digest("hex"),
          status: "exported",
          errorMessage,
        });
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });

  transform.on("error", (error) => {
    rejectWith(error);
  });

  pipeline(sourceStream, transform).catch((error) => {
    transform.destroy(error);
    rejectWith(error);
  });

  return { stream: transform, completed };
};

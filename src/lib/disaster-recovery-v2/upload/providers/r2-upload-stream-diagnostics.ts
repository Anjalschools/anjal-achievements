import type { ReadStream } from "fs";

import { logMemorySnapshot } from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export const attachR2UploadStreamDiagnostics = (
  readStream: ReadStream,
  input: { jobId: string; objectKey: string; totalBytes: number }
): void => {
  readStream.on("pause", () => {
    logDrV2("UPLOAD_BACKPRESSURE", {
      jobId: input.jobId,
      objectKey: input.objectKey,
      state: "paused",
      bytesRead: readStream.bytesRead,
      readableLength: readStream.readableLength,
    });
    logMemorySnapshot("UPLOAD_BACKPRESSURE", {
      jobId: input.jobId,
      objectKey: input.objectKey,
      state: "paused",
      bytesRead: readStream.bytesRead,
    });
  });

  readStream.on("resume", () => {
    logDrV2("UPLOAD_BACKPRESSURE", {
      jobId: input.jobId,
      objectKey: input.objectKey,
      state: "resumed",
      bytesRead: readStream.bytesRead,
      readableLength: readStream.readableLength,
    });
  });

  readStream.on("drain", () => {
    logDrV2("UPLOAD_SOCKET_DRAIN", {
      jobId: input.jobId,
      objectKey: input.objectKey,
      bytesRead: readStream.bytesRead,
    });
  });

  const logInternalBuffer = (stage: string): void => {
    logDrV2("UPLOAD_INTERNAL_BUFFER", {
      jobId: input.jobId,
      objectKey: input.objectKey,
      stage,
      bytesRead: readStream.bytesRead,
      readableLength: readStream.readableLength,
      readableHighWaterMark: readStream.readableHighWaterMark,
      destroyed: readStream.destroyed,
      readableEnded: readStream.readableEnded,
    });
  };

  readStream.once("open", () => logInternalBuffer("open"));
  readStream.once("end", () => logInternalBuffer("end"));
  readStream.once("close", () => logInternalBuffer("close"));
};

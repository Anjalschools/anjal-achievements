import { PassThrough } from "stream";
import { describe, expect, it, vi } from "vitest";

import {
  attachDrObjectStreamErrorLogging,
  logDrDownloadProviderFailed,
} from "@/lib/disaster-recovery/dr-object-stream-diagnostics";

describe("phase 11.6.C — object stream diagnostics", () => {
  it("logs OBJECT_STREAM_ERROR when a stream emits error", () => {
    const stream = new PassThrough();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    attachDrObjectStreamErrorLogging(stream, {
      provider: "cloudinary",
      storageKey: "cloudinary://image/sample",
      archivePath: "objects/sample.bin",
      objectId: "entry-1",
      streamName: "test-stream",
    });

    const rootError = new Error("HTTP 404");
    stream.emit("error", rootError);

    expect(errorSpy).toHaveBeenCalledWith(
      "[DR] OBJECT_STREAM_ERROR",
      expect.objectContaining({
        provider: "cloudinary",
        message: "HTTP 404",
        archivePath: "objects/sample.bin",
        objectId: "entry-1",
      })
    );
  });

  it("logs DOWNLOAD_PROVIDER_FAILED and rethrows the original error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rootError = new Error("CLOUDINARY_DOWNLOAD_FAILED:404");

    expect(() => {
      logDrDownloadProviderFailed(
        {
          provider: "cloudinary",
          storageKey: "cloudinary://image/sample",
          archivePath: "objects/sample.bin",
          objectId: "entry-1",
        },
        rootError
      );
      throw rootError;
    }).toThrow(rootError);

    expect(errorSpy).toHaveBeenCalledWith(
      "[DR] DOWNLOAD_PROVIDER_FAILED",
      expect.objectContaining({
        provider: "cloudinary",
        message: "CLOUDINARY_DOWNLOAD_FAILED:404",
      })
    );
  });
});

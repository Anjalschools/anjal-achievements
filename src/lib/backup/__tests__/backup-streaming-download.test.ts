vi.mock("server-only", () => ({}));

import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import {
  buildR2BackupDownloadS3ClientConfig,
  openR2BackupObjectReadStream,
  resetR2BackupDownloadS3ClientCacheForTests,
} from "@/lib/backup/r2-backup-download-client";
import {
  createBackupDownloadDiagnosticContext,
  pipeBackupNodeReadableToWebStream,
} from "@/lib/backup/backup-download-stream";
import { bufferToDownloadStream } from "@/lib/backup/backup-storage";

const mockSettings = {
  endpoint: "https://example.r2.cloudflarestorage.com",
  credentials: { accessKeyId: "a".repeat(32), secretAccessKey: "b".repeat(40) },
  bucket: "test-bucket",
  publicBaseUrl: "https://cdn.example.com",
  accessKeySource: "R2_ACCESS_KEY_ID" as const,
  secretKeySource: "R2_SECRET_ACCESS_KEY" as const,
};

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@/lib/storage/r2-config", () => ({
  createOrGetR2S3Client: () => ({
    client: { send: sendMock } as unknown as S3Client,
    settings: mockSettings,
  }),
}));

vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-s3")>("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(function MockS3Client() {
      return { send: sendMock };
    }),
  };
});

const drainWebStream = async (stream: ReadableStream<Uint8Array>): Promise<number> => {
  const reader = stream.getReader();
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value?.byteLength ?? 0;
  }
  return bytes;
};

describe("DR.BACKUP.V2.10.D — streaming download pipeline", () => {
  beforeEach(() => {
    sendMock.mockReset();
    resetR2BackupDownloadS3ClientCacheForTests();
  });

  afterEach(() => {
    resetR2BackupDownloadS3ClientCacheForTests();
  });

  it("configures the R2 download client without auto response checksum buffering", () => {
    const config = buildR2BackupDownloadS3ClientConfig(mockSettings);
    expect(config.requestChecksumCalculation).toBe("WHEN_REQUIRED");
    expect(config.responseChecksumValidation).toBe("WHEN_REQUIRED");
  });

  it("returns a Readable from openR2BackupObjectReadStream without buffering", async () => {
    const payload = Buffer.from("zip-chunk-data");
    const body = Readable.from([payload]);
    sendMock.mockResolvedValue({
      Body: body,
      ContentLength: payload.byteLength,
      ETag: '"etag-1"',
    });

    const opened = await openR2BackupObjectReadStream({ key: "dr-v2/backups/job/backup.zip" });

    expect(opened.body).toBeInstanceOf(Readable);
    expect(opened.contentLength).toBe(payload.byteLength);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("converts a Node Readable to a Web stream without materializing buffers", async () => {
    const payload = Buffer.alloc(256 * 1024, 0x5a);
    const nodeStream = Readable.from([payload]);
    const context = createBackupDownloadDiagnosticContext({
      recordId: "record-1",
      provider: "r2",
      storageKey: "dr-v2/backups/job/backup.zip",
    });

    const webStream = pipeBackupNodeReadableToWebStream({
      stream: nodeStream,
      context,
    });

    const bytes = await drainWebStream(webStream);
    expect(bytes).toBe(payload.byteLength);
  });

  it("aborts upstream Node stream when the client disconnects", async () => {
    const controller = new AbortController();
    const nodeStream = Readable.from(
      (async function* () {
        yield Buffer.from("a");
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield Buffer.from("b");
      })()
    );

    const context = createBackupDownloadDiagnosticContext({
      recordId: "record-abort",
      provider: "r2",
    });

    const webStream = pipeBackupNodeReadableToWebStream({
      stream: nodeStream,
      context,
      abortSignal: controller.signal,
    });

    const reader = webStream.getReader();
    await reader.read();
    controller.abort();
    await reader.cancel().catch(() => undefined);

    expect(nodeStream.destroyed).toBe(true);
  });

  it("wraps local cached buffers as a Readable for unified download path", async () => {
    const payload = Buffer.from("local-backup");
    const stream = bufferToDownloadStream(payload);
    const bytes = await drainWebStream(
      pipeBackupNodeReadableToWebStream({
        stream,
        context: createBackupDownloadDiagnosticContext({
          recordId: "local-record",
          provider: "local",
        }),
      })
    );

    expect(bytes).toBe(payload.byteLength);
  });
});

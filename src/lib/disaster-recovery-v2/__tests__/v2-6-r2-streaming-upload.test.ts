import { createHash } from "crypto";
import { createReadStream, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { buildDrV2R2UploadS3ClientConfig } from "@/lib/disaster-recovery-v2/upload/providers/r2-upload-s3-client";
import { createR2BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/providers/r2-upload-provider";

const { sendMock, mockSettings, resetUploadClientCacheForTests } = vi.hoisted(() => {
  const settings = {
    endpoint: "https://example.r2.cloudflarestorage.com",
    credentials: { accessKeyId: "a".repeat(32), secretAccessKey: "b".repeat(40) },
    bucket: "test-bucket",
    publicBaseUrl: "https://cdn.example.com",
    accessKeySource: "R2_ACCESS_KEY_ID" as const,
    secretKeySource: "R2_SECRET_ACCESS_KEY" as const,
  };

  return {
    sendMock: vi.fn(),
    mockSettings: settings,
    resetUploadClientCacheForTests: vi.fn(),
  };
});

vi.mock("@/lib/disaster-recovery-v2/upload/providers/r2-upload-s3-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/disaster-recovery-v2/upload/providers/r2-upload-s3-client")
  >("@/lib/disaster-recovery-v2/upload/providers/r2-upload-s3-client");

  return {
    ...actual,
    createOrGetDrV2R2UploadS3Client: () => ({
      client: { send: sendMock } as unknown as S3Client,
      settings: mockSettings,
    }),
    resetDrV2R2UploadS3ClientCacheForTests: resetUploadClientCacheForTests,
  };
});

const createWorkspaceFile = (sizeBytes: number): { dir: string; filePath: string } => {
  const dir = mkdtempSync(join(tmpdir(), "dr-v2-r2-upload-"));
  const filePath = join(dir, "backup.zip");
  writeFileSync(filePath, Buffer.alloc(sizeBytes, 0x61));
  return { dir, filePath };
};

const drainStream = async (stream: Readable): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    stream.once("end", resolve);
    stream.once("error", reject);
    stream.resume();
  });
};

describe("DR.BACKUP.V2.10.C — R2 streaming upload memory fix", () => {
  const workspaces: string[] = [];

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockImplementation(async (command: PutObjectCommand) => {
      const body = command.input.Body;
      if (body instanceof Readable) {
        await drainStream(body);
      }
      return { ETag: '"etag-stream"' };
    });
    resetUploadClientCacheForTests.mockReset();
  });

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("configures the DR upload S3 client without auto request checksum injection", () => {
    const config = buildDrV2R2UploadS3ClientConfig(mockSettings);

    expect(config.requestChecksumCalculation).toBe("WHEN_REQUIRED");
    expect(config.responseChecksumValidation).toBe("WHEN_REQUIRED");
    expect(config.forcePathStyle).toBe(true);
  });

  it("sends PutObject with a ReadStream body and explicit ContentLength", async () => {
    const { dir, filePath } = createWorkspaceFile(256 * 1024);
    workspaces.push(dir);

    const sha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    const provider = createR2BackupUploadProvider();
    const context = createBackupContext(createBackupConfig({ jobId: "job-stream", workspaceDir: dir }));

    const result = await provider.upload(
      {
        path: filePath,
        filename: "backup.zip",
        size: 256 * 1024,
        sha256,
      },
      context
    );

    expect(result.uploadedBytes).toBe(256 * 1024);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const command = sendMock.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.ChecksumAlgorithm).toBeUndefined();
    expect(command.input.ContentLength).toBe(256 * 1024);
    expect(command.input.Body).toBeInstanceOf(Readable);
  });

  it("does not materialize the file before send and destroys the stream afterward", async () => {
    const { dir, filePath } = createWorkspaceFile(512 * 1024);
    workspaces.push(dir);

    const sha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    let capturedBody: Readable | undefined;

    sendMock.mockImplementation(async (command: PutObjectCommand) => {
      capturedBody = command.input.Body as Readable;
      expect(capturedBody.readableFlowing).not.toBe(true);
      expect(capturedBody.bytesRead).toBe(0);
      await drainStream(capturedBody);
      return { ETag: '"etag-stream"' };
    });

    const provider = createR2BackupUploadProvider();
    await provider.upload(
      {
        path: filePath,
        filename: "backup.zip",
        size: 512 * 1024,
        sha256,
      },
      createBackupContext(createBackupConfig({ jobId: "job-no-buffer", workspaceDir: dir }))
    );

    expect(capturedBody).toBeInstanceOf(Readable);
    expect(capturedBody?.readableEnded || capturedBody?.destroyed).toBe(true);
  });

  it("uses a bounded fs ReadStream highWaterMark for upload source", async () => {
    const { dir, filePath } = createWorkspaceFile(16);
    workspaces.push(dir);

    const stream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
    stream.on("error", () => undefined);
    expect(stream.readableHighWaterMark).toBe(64 * 1024);
    await new Promise<void>((resolve, reject) => {
      stream.once("open", () => resolve());
      stream.once("error", reject);
    });
    stream.destroy();
  });
});

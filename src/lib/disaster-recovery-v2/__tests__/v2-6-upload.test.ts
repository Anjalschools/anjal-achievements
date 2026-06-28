import { createHash } from "crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { mkdir, writeFile, stat } from "fs/promises";
import { dirname } from "path";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi, afterEach } from "vitest";

import { BACKUP_ZIP_FILE_NAME } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import { resolveBackupZipPath } from "@/lib/disaster-recovery-v2/package/package-paths";
import { resolvePackageManifestPath } from "@/lib/disaster-recovery-v2/package/package-paths";
import {
  createUploadStage,
  executeUploadStage,
} from "@/lib/disaster-recovery-v2/upload/create-upload-stage";
import type { UploadDependencies } from "@/lib/disaster-recovery-v2/upload/upload-dependencies";
import type { UploadReport } from "@/lib/disaster-recovery-v2/upload/upload-artifact-types";
import { resolveUploadReportPath } from "@/lib/disaster-recovery-v2/upload/upload-paths";
import type { BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/upload-provider";
import { UploadProviderError } from "@/lib/disaster-recovery-v2/upload/upload-retry-policy";
import { createR2BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/providers/r2-upload-provider";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-upload-"));

const writePackageInputs = async (input: {
  workspaceDir: string;
  zipContent?: Buffer;
  sha256?: string;
}): Promise<{ sha256: string; size: number }> => {
  const zipContent = input.zipContent ?? Buffer.from("backup-payload");
  const sha256 =
    input.sha256 ?? createHash("sha256").update(zipContent).digest("hex");

  await mkdir(join(input.workspaceDir, "package"), { recursive: true });
  await mkdir(join(input.workspaceDir, "metadata"), { recursive: true });
  await writeFile(resolveBackupZipPath(input.workspaceDir), zipContent);

  await writeFile(
    resolvePackageManifestPath(input.workspaceDir),
    `${JSON.stringify({
      version: 2,
      createdAt: new Date().toISOString(),
      database: {
        collectionCount: 0,
        documentCount: 0,
        exportedCollections: 0,
        failedCollections: 0,
      },
      storage: { objectCount: 0, totalBytes: 0, providerCount: 0 },
      assets: {
        totalAssets: 0,
        downloaded: 0,
        skipped: 0,
        missing: 0,
        failed: 0,
        totalBytes: 0,
      },
      package: {
        zipFile: BACKUP_ZIP_FILE_NAME,
        size: zipContent.byteLength,
        sha256,
        entryCount: 1,
      },
      verification: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        entryCount: 1,
        sha256,
      },
    })}\n`
  );

  return { sha256, size: zipContent.byteLength };
};

const createMockProvider = (handler: BackupUploadProvider["upload"]): BackupUploadProvider => ({
  id: "mock-r2",
  upload: handler,
});

const createMockDeps = (): UploadDependencies => ({
  readPackageManifest: async (manifestPath) =>
    JSON.parse(readFileSync(manifestPath, "utf8")),
  statFile: async (filePath) => stat(filePath),
  computeSha256: async (filePath) => {
    const content = readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex");
  },
  writeUploadReport: async (reportPath, report) => {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  },
  sleep: async () => undefined,
});

const collectLogEvents = (): { events: string[]; restore: () => void } => {
  const events: string[] = [];
  const infoSpy = vi.spyOn(console, "info").mockImplementation((message: unknown) => {
    events.push(String(message));
  });
  return { events, restore: () => infoSpy.mockRestore() };
};

describe("DR.BACKUP.V2.6 — upload stage", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("uploads backup.zip successfully and generates upload-report.json", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { sha256, size } = await writePackageInputs({ workspaceDir });
    const zipPath = resolveBackupZipPath(workspaceDir);
    const zipBefore = readFileSync(zipPath);

    let uploadedArtifactPath = "";
    const provider = createMockProvider(async (artifact) => {
      uploadedArtifactPath = artifact.path;
      return {
        provider: "mock-r2",
        objectKey: "dr-v2/backups/job-upload/backup.zip",
        etag: "etag-123",
        uploadedBytes: artifact.size,
        completedAt: new Date("2026-06-28T02:00:00.000Z"),
      };
    });

    const result = await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-upload", workspaceDir }))
    );

    expect(result.success).toBe(true);
    expect(uploadedArtifactPath).toBe(zipPath);
    expect(existsSync(resolveUploadReportPath(workspaceDir))).toBe(true);
    expect(readFileSync(zipPath).equals(zipBefore)).toBe(true);

    const report = JSON.parse(
      readFileSync(resolveUploadReportPath(workspaceDir), "utf8")
    ) as UploadReport;
    expect(report).toMatchObject({
      provider: "mock-r2",
      filename: BACKUP_ZIP_FILE_NAME,
      bytes: size,
      sha256,
      objectKey: "dr-v2/backups/job-upload/backup.zip",
      etag: "etag-123",
    });
  });

  it("retries transient failures and succeeds on the second attempt", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({ workspaceDir });

    let attempts = 0;
    const provider = createMockProvider(async (artifact) => {
      attempts += 1;
      if (attempts === 1) {
        throw new UploadProviderError("HTTP_503", { httpStatus: 503 });
      }
      return {
        provider: "mock-r2",
        objectKey: "key",
        uploadedBytes: artifact.size,
        completedAt: new Date(),
      };
    });

    const result = await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-retry", workspaceDir }))
    );

    expect(result.success).toBe(true);
    expect(attempts).toBe(2);
  });

  it("returns failure for permanent provider errors without deleting backup.zip", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({ workspaceDir });
    const zipPath = resolveBackupZipPath(workspaceDir);
    const zipBefore = readFileSync(zipPath);

    const provider = createMockProvider(async () => {
      throw new UploadProviderError("AccessDenied", { httpStatus: 403, permanent: true });
    });

    const result = await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-permanent", workspaceDir }))
    );

    expect(result.success).toBe(false);
    expect(readFileSync(zipPath).equals(zipBefore)).toBe(true);
    expect(existsSync(resolveUploadReportPath(workspaceDir))).toBe(false);
  });

  it("fails when checksum does not match the package manifest", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({
      workspaceDir,
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    });

    const provider = createMockProvider(async () => ({
      provider: "mock-r2",
      objectKey: "key",
      uploadedBytes: 1,
      completedAt: new Date(),
    }));

    const result = await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-checksum", workspaceDir }))
    );

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("UPLOAD_CHECKSUM_MISMATCH");
  });

  it("fails when uploaded byte count does not match the local file size", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({ workspaceDir });

    const provider = createMockProvider(async (artifact) => ({
      provider: "mock-r2",
      objectKey: "key",
      uploadedBytes: artifact.size - 1,
      completedAt: new Date(),
    }));

    const result = await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-bytes", workspaceDir }))
    );

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("UPLOAD_BYTE_COUNT_MISMATCH");
  });

  it("uses the provider abstraction without requiring R2 configuration in tests", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({ workspaceDir });

    const provider = createR2BackupUploadProvider({
      putObject: async ({ artifact, objectKey }) => ({
        provider: "r2",
        objectKey,
        uploadedBytes: artifact.size,
        completedAt: new Date(),
      }),
    });

    const result = await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-provider", workspaceDir }))
    );

    expect(result.success).toBe(true);
    expect(
      JSON.parse(readFileSync(resolveUploadReportPath(workspaceDir), "utf8")).provider
    ).toBe("r2");
  });

  it("emits required upload lifecycle logs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({ workspaceDir });

    const provider = createMockProvider(async (artifact) => ({
      provider: "mock-r2",
      objectKey: "key",
      uploadedBytes: artifact.size,
      completedAt: new Date(),
    }));

    const { events, restore } = collectLogEvents();
    await createUploadStage(provider, createMockDeps()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-logs", workspaceDir }))
    );
    restore();

    for (const event of [
      "UPLOAD_STAGE_STARTED",
      "UPLOAD_PROVIDER_STARTED",
      "UPLOAD_PROVIDER_COMPLETED",
      "UPLOAD_VERIFIED",
      "UPLOAD_STAGE_COMPLETED",
    ]) {
      expect(events.some((line) => line.includes(`[DR.V2] ${event}`))).toBe(true);
    }
  });

  it("reads only backup.zip and package manifest inputs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writePackageInputs({ workspaceDir });

    const readPaths: string[] = [];
    const deps = createMockDeps();
    const provider = createMockProvider(async (artifact) => {
      readPaths.push(artifact.path);
      return {
        provider: "mock-r2",
        objectKey: "key",
        uploadedBytes: artifact.size,
        completedAt: new Date(),
      };
    });

    await executeUploadStage(
      createBackupContext(createBackupConfig({ jobId: "job-inputs", workspaceDir })),
      provider,
      {
        ...deps,
        readPackageManifest: async (manifestPath) => {
          readPaths.push(manifestPath);
          return deps.readPackageManifest(manifestPath);
        },
      }
    );

    expect(readPaths).toEqual([
      resolvePackageManifestPath(workspaceDir),
      resolveBackupZipPath(workspaceDir),
    ]);
  });
});

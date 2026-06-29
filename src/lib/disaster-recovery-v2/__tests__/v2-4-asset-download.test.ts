import { createHash } from "crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { mkdir, writeFile, rename, rm, stat } from "fs/promises";
import { dirname } from "path";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi, afterEach } from "vitest";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import {
  createAssetDownloadStage,
  executeAssetDownloadStage,
} from "@/lib/disaster-recovery-v2/storage/asset-download/create-asset-download-stage";
import {
  resolveAssetDownloadReportPath,
  resolveAssetAbsolutePath,
  resolveAssetTempPath,
  resolveMissingAssetsPath,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-paths";
import type { AssetDownloadDependencies } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-dependencies";
import type { AssetDownloadReport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import type { MissingAssetsManifest } from "@/lib/disaster-recovery-v2/storage/asset-download/missing-assets-types";
import { resolveAssetRelativePath } from "@/lib/disaster-recovery-v2/storage/asset-download/resolve-asset-file-path";
import { AssetDownloadHttpError } from "@/lib/disaster-recovery-v2/storage/asset-download/retry-policy";
import type { AssetDownloadTransport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-transport";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import type { StorageDiscoveryAsset, StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-asset-download-"));

const buildAsset = (
  overrides: Partial<StorageDiscoveryAsset> & Pick<StorageDiscoveryAsset, "objectId" | "publicId" | "storageKey">
): StorageDiscoveryAsset => ({
  provider: "cloudinary",
  checksumAvailable: false,
  downloadUrl: "https://example.com/asset.bin",
  folder: "photos",
  version: 1,
  contentType: "image/jpg",
  ...overrides,
});

const writeStorageManifest = async (
  workspaceDir: string,
  objects: StorageDiscoveryAsset[]
): Promise<void> => {
  const manifest: StorageManifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    objectCount: objects.length,
    totalBytes: objects.reduce((total, asset) => total + (asset.bytes ?? 0), 0),
    objects,
    duplicateWarnings: [],
    providerSummaries: [],
  };

  await mkdir(join(workspaceDir, "storage"), { recursive: true });
  await writeFile(resolveStorageManifestPath(workspaceDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
};

const createMockDeps = (input: {
  workspaceDir: string;
  transport: AssetDownloadTransport;
  renameFile?: AssetDownloadDependencies["renameFile"];
  removeFile?: AssetDownloadDependencies["removeFile"];
}): AssetDownloadDependencies => ({
  readStorageManifest: async (manifestPath) =>
    JSON.parse(readFileSync(manifestPath, "utf8")) as StorageManifest,
  ensureDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeJsonFile: async (filePath, payload) => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  },
  transport: input.transport,
  renameFile:
    input.renameFile ??
    (async (sourcePath, destinationPath) => {
      await rename(sourcePath, destinationPath);
    }),
  removeFile:
    input.removeFile ??
    (async (filePath) => {
      await rm(filePath, { force: true });
    }),
  statFile: async (filePath) => stat(filePath),
  computeSha256: computeFileSha256,
  sleep: async () => undefined,
});

const readReport = (workspaceDir: string): AssetDownloadReport =>
  JSON.parse(readFileSync(resolveAssetDownloadReportPath(workspaceDir), "utf8")) as AssetDownloadReport;

const readMissingAssets = (workspaceDir: string): MissingAssetsManifest =>
  JSON.parse(readFileSync(resolveMissingAssetsPath(workspaceDir), "utf8")) as MissingAssetsManifest;

const collectLogEvents = (): { events: string[]; restore: () => void } => {
  const events: string[] = [];
  const infoSpy = vi.spyOn(console, "info").mockImplementation((message: unknown) => {
    events.push(String(message));
  });
  return { events, restore: () => infoSpy.mockRestore() };
};

describe("DR.BACKUP.V2.4 — asset download stage", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("handles an empty storage manifest", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writeStorageManifest(workspaceDir, []);

    const transport: AssetDownloadTransport = {
      download: vi.fn(async () => ({ bytesWritten: 0 })),
    };
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-empty", workspaceDir })
    );

    const result = await createAssetDownloadStage(
      createMockDeps({ workspaceDir, transport })
    ).execute(context);

    expect(result.success).toBe(true);
    const report = readReport(workspaceDir);
    expect(report.totalAssets).toBe(0);
    expect(report.downloaded).toBe(0);
    expect(transport.download).not.toHaveBeenCalled();
  });

  it("downloads a single asset successfully with checksum after close", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const asset = buildAsset({
      objectId: "cloudinary:image:alpha@1",
      publicId: "alpha",
      storageKey: "cloudinary://image/alpha",
      folder: "photos",
      version: 2,
      bytes: 11,
    });
    await writeStorageManifest(workspaceDir, [asset]);

    const payload = Buffer.from("hello-world");
    const transport: AssetDownloadTransport = {
      download: async ({ tempPath, signal }) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        await writeFile(tempPath, payload);
        return { contentLength: payload.byteLength, bytesWritten: payload.byteLength };
      },
    };

    const context = createBackupContext(
      createBackupConfig({ jobId: "job-single", workspaceDir })
    );
    const result = await createAssetDownloadStage(
      createMockDeps({ workspaceDir, transport })
    ).execute(context);

    expect(result.success).toBe(true);

    const relativePath = resolveAssetRelativePath(asset);
    const absolutePath = resolveAssetAbsolutePath(workspaceDir, relativePath);
    expect(existsSync(absolutePath)).toBe(true);
    expect(existsSync(resolveAssetTempPath(absolutePath))).toBe(false);

    const report = readReport(workspaceDir);
    expect(report.downloaded).toBe(1);
    expect(report.assets[0].status).toBe("downloaded");
    expect(report.assets[0].sha256).toBe(
      createHash("sha256").update(payload).digest("hex")
    );
  });

  it("downloads multiple assets sequentially in deterministic order", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const assets = [
      buildAsset({
        objectId: "2",
        publicId: "z/file",
        storageKey: "cloudinary://image/z/file",
        folder: "z",
        downloadUrl: "https://example.com/z",
      }),
      buildAsset({
        objectId: "1",
        publicId: "a/file",
        storageKey: "cloudinary://image/a/file",
        folder: "a",
        downloadUrl: "https://example.com/a",
      }),
    ];
    await writeStorageManifest(workspaceDir, assets);

    const downloadOrder: string[] = [];
    const transport: AssetDownloadTransport = {
      download: async ({ tempPath, url }) => {
        downloadOrder.push(url);
        await writeFile(tempPath, Buffer.from(url));
        return { bytesWritten: url.length };
      },
    };

    await createAssetDownloadStage(createMockDeps({ workspaceDir, transport })).execute(
      createBackupContext(createBackupConfig({ jobId: "job-multi", workspaceDir }))
    );

    expect(downloadOrder).toEqual(["https://example.com/a", "https://example.com/z"]);
    expect(readReport(workspaceDir).downloaded).toBe(2);
  });

  it("retries transient failures and succeeds on the third attempt", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const asset = buildAsset({
      objectId: "retry-asset",
      publicId: "retry",
      storageKey: "cloudinary://image/retry",
    });
    await writeStorageManifest(workspaceDir, [asset]);

    let attempts = 0;
    const transport: AssetDownloadTransport = {
      download: async ({ tempPath }) => {
        attempts += 1;
        if (attempts < 3) {
          throw new AssetDownloadHttpError("HTTP_503", 503);
        }
        await writeFile(tempPath, Buffer.from("ok"));
        return { bytesWritten: 2 };
      },
    };

    const result = await createAssetDownloadStage(
      createMockDeps({ workspaceDir, transport })
    ).execute(createBackupContext(createBackupConfig({ jobId: "job-retry", workspaceDir })));

    expect(result.success).toBe(true);
    expect(attempts).toBe(3);
    expect(readReport(workspaceDir).retries).toBe(2);
  });

  it("records permanent 404 assets in missing-assets.json without retrying", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const asset = buildAsset({
      objectId: "missing-asset",
      publicId: "missing",
      storageKey: "cloudinary://image/missing",
    });
    await writeStorageManifest(workspaceDir, [asset]);

    let attempts = 0;
    const transport: AssetDownloadTransport = {
      download: async () => {
        attempts += 1;
        throw new AssetDownloadHttpError("HTTP_404", 404);
      },
    };

    const result = await createAssetDownloadStage(
      createMockDeps({ workspaceDir, transport })
    ).execute(createBackupContext(createBackupConfig({ jobId: "job-404", workspaceDir })));

    expect(result.success).toBe(false);
    expect(attempts).toBe(1);
    expect(readReport(workspaceDir).missing).toBe(1);
    expect(existsSync(resolveMissingAssetsPath(workspaceDir))).toBe(true);

    const missingAssets = readMissingAssets(workspaceDir);
    expect(missingAssets.entries[0]).toMatchObject({
      provider: "cloudinary",
      storageKey: asset.storageKey,
      publicId: "missing",
      httpStatus: 404,
      attempts: 1,
    });
    expect(JSON.stringify(missingAssets.entries[0])).not.toMatch(/stack/i);
  });

  it("uses atomic rename from .tmp to final path", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const asset = buildAsset({
      objectId: "atomic",
      publicId: "atomic",
      storageKey: "cloudinary://image/atomic",
    });
    await writeStorageManifest(workspaceDir, [asset]);

    const renameCalls: Array<{ source: string; destination: string }> = [];
    const transport: AssetDownloadTransport = {
      download: async ({ tempPath }) => {
        await writeFile(tempPath, Buffer.from("data"));
        return { bytesWritten: 4 };
      },
    };

    await createAssetDownloadStage(
      createMockDeps({
        workspaceDir,
        transport,
        renameFile: async (sourcePath, destinationPath) => {
          renameCalls.push({ source: sourcePath, destination: destinationPath });
          const { rename } = await import("fs/promises");
          await rename(sourcePath, destinationPath);
        },
      })
    ).execute(createBackupContext(createBackupConfig({ jobId: "job-atomic", workspaceDir })));

    expect(renameCalls).toHaveLength(1);
    expect(renameCalls[0].source.endsWith(".tmp")).toBe(true);
    expect(renameCalls[0].destination.endsWith(".tmp")).toBe(false);
  });

  it("removes temporary files when download is interrupted", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const asset = buildAsset({
      objectId: "interrupt",
      publicId: "interrupt",
      storageKey: "cloudinary://image/interrupt",
    });
    await writeStorageManifest(workspaceDir, [asset]);

    const removedPaths: string[] = [];
    const transport: AssetDownloadTransport = {
      download: async ({ tempPath }) => {
        await writeFile(tempPath, Buffer.from("partial"));
        throw new Error("DOWNLOAD_INTERRUPTED");
      },
    };

    await createAssetDownloadStage(
      createMockDeps({
        workspaceDir,
        transport,
        removeFile: async (filePath) => {
          removedPaths.push(filePath);
          const { rm } = await import("fs/promises");
          await rm(filePath, { force: true });
        },
      })
    ).execute(createBackupContext(createBackupConfig({ jobId: "job-interrupt", workspaceDir })));

    const relativePath = resolveAssetRelativePath(asset);
    const absolutePath = resolveAssetAbsolutePath(workspaceDir, relativePath);
    expect(removedPaths.some((filePath) => filePath.endsWith(".tmp"))).toBe(true);
    expect(existsSync(absolutePath)).toBe(false);
    expect(existsSync(resolveAssetTempPath(absolutePath))).toBe(false);
    expect(readReport(workspaceDir).failed).toBe(1);
  });

  it("builds deterministic asset paths from provider, folder, publicId, and version", () => {
    expect(
      resolveAssetRelativePath(
        buildAsset({
          objectId: "1",
          provider: "cloudinary",
          publicId: "school/logo",
          storageKey: "cloudinary://image/school/logo",
          folder: "school",
          version: 42,
          contentType: "image/png",
        })
      )
    ).toBe("assets/cloudinary/school/v42/logo.png");
  });

  it("generates asset-download-report.json with terminal states for every asset", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const assets = [
      buildAsset({
        objectId: "ok",
        publicId: "ok",
        storageKey: "cloudinary://image/ok",
        downloadUrl: "https://example.com/ok",
      }),
      buildAsset({
        objectId: "skip",
        publicId: "skip",
        storageKey: "cloudinary://image/skip",
        downloadUrl: "",
      }),
      buildAsset({
        objectId: "missing",
        publicId: "missing",
        storageKey: "cloudinary://image/missing",
        downloadUrl: "https://example.com/missing",
      }),
    ];
    await writeStorageManifest(workspaceDir, assets);

    const transport: AssetDownloadTransport = {
      download: async ({ tempPath, url }) => {
        if (url.includes("missing")) {
          throw new AssetDownloadHttpError("HTTP_404", 404);
        }
        await writeFile(tempPath, Buffer.from("x"));
        return { bytesWritten: 1 };
      },
    };

    await executeAssetDownloadStage(
      createBackupContext(createBackupConfig({ jobId: "job-report", workspaceDir })),
      createMockDeps({ workspaceDir, transport })
    );

    const report = readReport(workspaceDir);
    expect(report.totalAssets).toBe(3);
    expect(report.downloaded).toBe(1);
    expect(report.skipped).toBe(1);
    expect(report.missing).toBe(1);
    expect(
      report.assets.every((entry) =>
        entry.status === "downloaded" ||
        entry.status === "failed" ||
        entry.status === "skipped" ||
        entry.status === "missing"
      )
    ).toBe(true);
    expect(existsSync(resolveStorageManifestPath(workspaceDir))).toBe(true);
    expect(
      JSON.parse(readFileSync(resolveStorageManifestPath(workspaceDir), "utf8")).objectCount
    ).toBe(3);
  });

  it("emits required asset download lifecycle logs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writeStorageManifest(workspaceDir, [
      buildAsset({
        objectId: "logged",
        publicId: "logged",
        storageKey: "cloudinary://image/logged",
      }),
    ]);

    const transport: AssetDownloadTransport = {
      download: async ({ tempPath }) => {
        await writeFile(tempPath, Buffer.from("x"));
        return { bytesWritten: 1 };
      },
    };
    const { events, restore } = collectLogEvents();

    await createAssetDownloadStage(createMockDeps({ workspaceDir, transport })).execute(
      createBackupContext(createBackupConfig({ jobId: "job-logs", workspaceDir }))
    );
    restore();

    for (const event of [
      "ASSET_DOWNLOAD_STARTED",
      "ASSET_VERIFIED",
      "ASSET_DOWNLOAD_COMPLETED",
      "DOWNLOAD_STAGE_COMPLETED",
    ]) {
      expect(events.some((line) => line.includes(`[DR.V2] ${event}`))).toBe(true);
    }
  });

  it("continues downloading after one asset fails", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await writeStorageManifest(workspaceDir, [
      buildAsset({
        objectId: "fail",
        publicId: "fail",
        storageKey: "cloudinary://image/fail",
        downloadUrl: "https://example.com/fail",
      }),
      buildAsset({
        objectId: "pass",
        publicId: "pass",
        storageKey: "cloudinary://image/pass",
        downloadUrl: "https://example.com/pass",
      }),
    ]);

    const transport: AssetDownloadTransport = {
      download: async ({ tempPath, url }) => {
        if (url.includes("fail")) {
          throw new AssetDownloadHttpError("HTTP_403", 403);
        }
        await writeFile(tempPath, Buffer.from("ok"));
        return { bytesWritten: 2 };
      },
    };

    const result = await createAssetDownloadStage(
      createMockDeps({ workspaceDir, transport })
    ).execute(createBackupContext(createBackupConfig({ jobId: "job-continue", workspaceDir })));

    expect(result.success).toBe(false);
    expect(readReport(workspaceDir).downloaded).toBe(1);
    expect(readReport(workspaceDir).failed).toBe(1);
  });
});

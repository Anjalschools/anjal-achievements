import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { mkdir, writeFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi, afterEach } from "vitest";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import {
  collectPackageZipEntries,
  sortPackageZipEntries,
} from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import {
  createPackageBuildStage,
  executePackageBuildStage,
} from "@/lib/disaster-recovery-v2/package/create-package-build-stage";
import type { PackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { createDefaultPackageBuildDependencies, resolvePackageBuildPaths } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import {
  resolveBackupZipPath,
  resolvePackageManifestPath,
} from "@/lib/disaster-recovery-v2/package/package-paths";
import { createUnzipperBackupZipReader } from "@/lib/disaster-recovery-v2/package/verify-backup-zip";
import { resolveDatabaseCollectionsDir, resolveDatabaseManifestPath } from "@/lib/disaster-recovery-v2/database/database-paths";
import {
  resolveAssetDownloadReportPath,
  resolveAssetsRootDir,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-paths";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-package-"));

const collectLogEvents = (): { events: string[]; restore: () => void } => {
  const events: string[] = [];
  const infoSpy = vi.spyOn(console, "info").mockImplementation((message: unknown) => {
    events.push(String(message));
  });
  return { events, restore: () => infoSpy.mockRestore() };
};

describe("DR.BACKUP.V2.5 — package build stage", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("builds an empty workspace package with manifest only", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    const deps = createDefaultPackageBuildDependencies();
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-empty", workspaceDir })
    );

    const result = await createPackageBuildStage(deps).execute(context);

    expect(result.success).toBe(true);
    expect(existsSync(resolveBackupZipPath(workspaceDir))).toBe(true);
    expect(existsSync(resolvePackageManifestPath(workspaceDir))).toBe(true);

    const manifest = JSON.parse(
      readFileSync(resolvePackageManifestPath(workspaceDir), "utf8")
    ) as PackageManifest;
    expect(manifest.version).toBe(2);
    expect(manifest.verification.verified).toBe(true);
    expect(manifest.package.entryCount).toBe(1);
  });

  it("packages database collections and metadata manifests", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await mkdir(resolveDatabaseCollectionsDir(workspaceDir), { recursive: true });
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "users.bson"), Buffer.from("bson"));
    await writeFile(
      resolveDatabaseManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        database: {
          collectionCount: 1,
          documentCount: 2,
          exportedCollections: [],
          failedCollections: [],
        },
      })}\n`
    );
    await mkdir(join(workspaceDir, "storage"), { recursive: true });
    await writeFile(
      resolveStorageManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        generatedAt: new Date().toISOString(),
        objectCount: 0,
        totalBytes: 0,
        objects: [],
        duplicateWarnings: [],
        providerSummaries: [],
      })}\n`
    );
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    const result = await createPackageBuildStage(createDefaultPackageBuildDependencies()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-db", workspaceDir }))
    );

    expect(result.success).toBe(true);

    const zipEntries = await createUnzipperBackupZipReader().listFileEntries(
      resolveBackupZipPath(workspaceDir)
    );
    expect(zipEntries).toContain("database/collections/users.bson");
    expect(zipEntries).toContain("metadata/database-manifest.json");
    expect(zipEntries).toContain("metadata/storage-manifest.json");
    expect(zipEntries).toContain("metadata/manifest.json");
  });

  it("packages downloaded assets under assets/", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    const assetPath = join(resolveAssetsRootDir(workspaceDir), "cloudinary", "photos", "v1", "logo.jpg");
    await mkdir(join(assetPath, ".."), { recursive: true });
    await writeFile(assetPath, Buffer.from("image-bytes"));
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    await createPackageBuildStage(createDefaultPackageBuildDependencies()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-assets", workspaceDir }))
    );

    const zipEntries = await createUnzipperBackupZipReader().listFileEntries(
      resolveBackupZipPath(workspaceDir)
    );
    expect(zipEntries).toContain("assets/cloudinary/photos/v1/logo.jpg");
  });

  it("orders zip entries deterministically by section and path", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const resolvedPaths = resolvePackageBuildPaths(workspaceDir);

    await mkdir(resolveDatabaseCollectionsDir(workspaceDir), { recursive: true });
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "b.bson"), "b");
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "a.bson"), "a");
    await writeFile(resolveDatabaseManifestPath(workspaceDir), "{}");
    await mkdir(join(workspaceDir, "storage"), { recursive: true });
    await writeFile(resolveStorageManifestPath(workspaceDir), "{}");
    await mkdir(join(resolveAssetsRootDir(workspaceDir), "cloudinary", "z", "v1"), { recursive: true });
    await mkdir(join(resolveAssetsRootDir(workspaceDir), "cloudinary", "a", "v1"), { recursive: true });
    await writeFile(join(resolveAssetsRootDir(workspaceDir), "cloudinary", "z", "v1", "z.bin"), "z");
    await writeFile(join(resolveAssetsRootDir(workspaceDir), "cloudinary", "a", "v1", "a.bin"), "a");
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    const deps = createDefaultPackageBuildDependencies();
    const entries = sortPackageZipEntries(
      await collectPackageZipEntries({
        workspaceDir,
        collector: deps.entryCollector,
        resolvePaths: resolvedPaths,
        includePackageManifest: false,
      })
    );

    expect(entries.map((entry) => entry.zipPath)).toEqual([
      "metadata/database-manifest.json",
      "metadata/storage-manifest.json",
      "database/collections/a.bson",
      "database/collections/b.bson",
      "assets/cloudinary/a/v1/a.bin",
      "assets/cloudinary/z/v1/z.bin",
    ]);
  });

  it("generates package manifest summaries and SHA256", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await mkdir(resolveDatabaseCollectionsDir(workspaceDir), { recursive: true });
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "users.bson"), "abc");
    await writeFile(
      resolveDatabaseManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        database: {
          collectionCount: 1,
          documentCount: 3,
          exportedCollections: [{ name: "users" }],
          failedCollections: [],
        },
      })}\n`
    );
    await mkdir(join(workspaceDir, "storage"), { recursive: true });
    await writeFile(
      resolveStorageManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        generatedAt: new Date().toISOString(),
        objectCount: 5,
        totalBytes: 500,
        objects: [],
        duplicateWarnings: [],
        providerSummaries: [{ provider: "cloudinary" }],
      })}\n`
    );
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });
    await writeFile(
      resolveAssetDownloadReportPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        generatedAt: new Date().toISOString(),
        totalAssets: 2,
        downloaded: 2,
        skipped: 0,
        missing: 0,
        failed: 0,
        retries: 0,
        totalBytes: 100,
        durationMs: 1,
        warnings: [],
        failures: [],
        assets: [],
      })}\n`
    );
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    await createPackageBuildStage(createDefaultPackageBuildDependencies()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-manifest", workspaceDir }))
    );

    const manifest = JSON.parse(
      readFileSync(resolvePackageManifestPath(workspaceDir), "utf8")
    ) as PackageManifest;

    expect(manifest.database.documentCount).toBe(3);
    expect(manifest.storage.objectCount).toBe(5);
    expect(manifest.assets.downloaded).toBe(2);
    expect(manifest.package.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.verification.verified).toBe(true);

    const zipSha256 = await computeFileSha256(resolveBackupZipPath(workspaceDir));
    expect(manifest.package.sha256).toBe(zipSha256);
  });

  it("aborts package creation when a source file is unreadable", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await mkdir(resolveDatabaseCollectionsDir(workspaceDir), { recursive: true });
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "broken.bson"), "x");
    await writeFile(
      resolveDatabaseManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        database: {
          collectionCount: 1,
          documentCount: 0,
          exportedCollections: [],
          failedCollections: [],
        },
      })}\n`
    );
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    const deps = createDefaultPackageBuildDependencies();
    const result = await createPackageBuildStage({
      ...deps,
      validateSourceReadable: async (filePath) => {
        if (filePath.endsWith("broken.bson")) {
          throw new Error("EACCES");
        }
        await readFileSync(filePath);
      },
    }).execute(createBackupContext(createBackupConfig({ jobId: "job-unreadable", workspaceDir })));

    expect(result.success).toBe(false);
    expect(existsSync(resolveBackupZipPath(workspaceDir))).toBe(false);
  });

  it("verifies zip integrity and entry count", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await mkdir(resolveDatabaseCollectionsDir(workspaceDir), { recursive: true });
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "items.bson"), "payload");
    await writeFile(
      resolveDatabaseManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        database: {
          collectionCount: 1,
          documentCount: 1,
          exportedCollections: [],
          failedCollections: [],
        },
      })}\n`
    );
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    await executePackageBuildStage(
      createBackupContext(createBackupConfig({ jobId: "job-integrity", workspaceDir })),
      createDefaultPackageBuildDependencies()
    );

    const zipPath = resolveBackupZipPath(workspaceDir);
    const zipStat = await stat(zipPath);
    expect(zipStat.size).toBeGreaterThan(0);

    const entries = await createUnzipperBackupZipReader().listFileEntries(zipPath);
    const manifest = JSON.parse(
      readFileSync(resolvePackageManifestPath(workspaceDir), "utf8")
    ) as PackageManifest;
    expect(entries.length).toBe(manifest.package.entryCount);
  });

  it("does not leave partial zip files on failure", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await mkdir(resolveDatabaseCollectionsDir(workspaceDir), { recursive: true });
    await writeFile(join(resolveDatabaseCollectionsDir(workspaceDir), "users.bson"), "x");
    await writeFile(
      resolveDatabaseManifestPath(workspaceDir),
      `${JSON.stringify({
        version: 2,
        database: {
          collectionCount: 1,
          documentCount: 0,
          exportedCollections: [],
          failedCollections: [],
        },
      })}\n`
    );
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    const deps = createDefaultPackageBuildDependencies();
    await createPackageBuildStage({
      ...deps,
      createZipWriter: () => ({
        appendFile: () => undefined,
        finalize: async () => {
          throw new Error("ZIP_BUILD_FAILED");
        },
      }),
    }).execute(createBackupContext(createBackupConfig({ jobId: "job-fail", workspaceDir })));

    expect(existsSync(`${resolveBackupZipPath(workspaceDir)}.tmp`)).toBe(false);
    expect(existsSync(resolveBackupZipPath(workspaceDir))).toBe(false);
  });

  it("emits required package lifecycle logs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });

    const { events, restore } = collectLogEvents();
    await createPackageBuildStage(createDefaultPackageBuildDependencies()).execute(
      createBackupContext(createBackupConfig({ jobId: "job-logs", workspaceDir }))
    );
    restore();

    for (const event of [
      "PACKAGE_ADD_FILE",
      "PACKAGE_STAGE_COMPLETED",
      "PACKAGE_VERIFIED",
    ]) {
      expect(events.some((line) => line.includes(`[DR.V2] ${event}`))).toBe(true);
    }
  });
});

import { createHash } from "crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { mkdir, writeFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { describe, expect, it, vi, afterEach } from "vitest";

import { resolveDatabaseCollectionsDir, resolveDatabaseManifestPath } from "@/lib/disaster-recovery-v2/database/database-paths";
import { createDefaultPackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import {
  createPackageBuildStage,
} from "@/lib/disaster-recovery-v2/package/create-package-build-stage";
import {
  resolveBackupZipPath,
  resolvePackageManifestPath,
} from "@/lib/disaster-recovery-v2/package/package-paths";
import { serializeDocumentsToBsonFile } from "@/lib/disaster-recovery-v2/restore/parse-bson-collection";
import { createRestoreConfig } from "@/lib/disaster-recovery-v2/restore/restore-config";
import { createRestoreContext } from "@/lib/disaster-recovery-v2/restore/restore-context";
import { createRestoreEngine, executeRestore } from "@/lib/disaster-recovery-v2/restore/restore-engine";
import {
  createInMemoryDatabaseRestorer,
  type RestoreEngineDependencies,
} from "@/lib/disaster-recovery-v2/restore/restore-dependencies";
import type { RestoreReport } from "@/lib/disaster-recovery-v2/restore/restore-report-types";
import { resolveRestoreReportPath } from "@/lib/disaster-recovery-v2/restore/restore-paths";
import { validateRestoreManifests } from "@/lib/disaster-recovery-v2/restore/validate-restore-manifests";
import { validateRestorePackage } from "@/lib/disaster-recovery-v2/restore/validate-restore-package";
import { restoreDatabaseCollections } from "@/lib/disaster-recovery-v2/restore/restore-database-collections";
import { restoreAssets } from "@/lib/disaster-recovery-v2/restore/restore-assets";
import { createCloudinaryAssetRestoreProvider } from "@/lib/disaster-recovery-v2/restore/providers/cloudinary-asset-restore-provider";
import type { DatabaseCollectionRestorer } from "@/lib/disaster-recovery-v2/restore/restore-database-collections";
import {
  resolveAssetDownloadReportPath,
  resolveAssetsRootDir,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-paths";
import { resolveAssetRelativePath } from "@/lib/disaster-recovery-v2/storage/asset-download/resolve-asset-file-path";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-restore-"));

type InMemoryDatabaseRestorer = DatabaseCollectionRestorer & {
  getRestored: () => Map<string, Record<string, unknown>[]>;
};

const createTestInMemoryDatabaseRestorer = (): InMemoryDatabaseRestorer =>
  createInMemoryDatabaseRestorer() as InMemoryDatabaseRestorer;

const buildCloudinaryStorageKey = (resourceType: string, publicId: string): string =>
  `cloudinary://${resourceType}/${publicId}`;

const buildAsset = (
  overrides: Partial<StorageDiscoveryAsset> & Pick<StorageDiscoveryAsset, "objectId" | "publicId" | "storageKey">
): StorageDiscoveryAsset => ({
  provider: "cloudinary",
  checksumAvailable: false,
  folder: "photos",
  version: 1,
  contentType: "image/jpg",
  ...overrides,
});

const ensureDir = (dirPath: string): void => {
  mkdirSync(dirPath, { recursive: true });
};

const writeJsonFileSync = (filePath: string, payload: unknown): void => {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
};

const buildValidPackageFixture = async (input: {
  workspaceDir: string;
  collections?: Record<string, Record<string, unknown>[]>;
  assets?: Array<{ asset: StorageDiscoveryAsset; content: Buffer }>;
}): Promise<{ zipPath: string; manifest: PackageManifest }> => {
  const { workspaceDir } = input;

  ensureDir(resolveDatabaseCollectionsDir(workspaceDir));
  ensureDir(join(workspaceDir, "metadata"));

  const collectionNames = Object.keys(input.collections ?? {});
  writeJsonFileSync(
    resolveDatabaseManifestPath(workspaceDir),
    {
      version: 2,
      database: {
        collectionCount: collectionNames.length,
        documentCount: Object.values(input.collections ?? {}).reduce(
          (total, docs) => total + docs.length,
          0
        ),
        exportedCollections: collectionNames.map((name) => ({
          name,
          documentCount: input.collections?.[name]?.length ?? 0,
          exportedFile: `collections/${name}.bson`,
          sha256: "fixture",
          sizeBytes: 1,
          durationMs: 1,
        })),
        failedCollections: [],
      },
    }
  );

  for (const [collectionName, documents] of Object.entries(input.collections ?? {})) {
    writeFileSync(
      join(resolveDatabaseCollectionsDir(workspaceDir), `${collectionName}.bson`),
      serializeDocumentsToBsonFile(documents)
    );
  }

  const storageObjects = (input.assets ?? []).map((entry) => entry.asset);
  writeJsonFileSync(resolveStorageManifestPath(workspaceDir), {
    version: 2,
    generatedAt: new Date().toISOString(),
    objectCount: storageObjects.length,
    totalBytes: storageObjects.reduce((total, _, index) => total + (input.assets?.[index]?.content.byteLength ?? 0), 0),
    objects: storageObjects,
    duplicateWarnings: [],
    providerSummaries: [{ provider: "cloudinary", objectCount: storageObjects.length, totalBytes: 0 }],
  });

  writeJsonFileSync(resolveAssetDownloadReportPath(workspaceDir), {
    version: 2,
    generatedAt: new Date().toISOString(),
    totalAssets: storageObjects.length,
    downloaded: storageObjects.length,
    skipped: 0,
    missing: 0,
    failed: 0,
    totalBytes: storageObjects.reduce((total, _, index) => total + (input.assets?.[index]?.content.byteLength ?? 0), 0),
    durationMs: 1,
    warnings: [],
    failures: [],
    assets: storageObjects.map((asset, index) => ({
      objectId: asset.objectId,
      provider: asset.provider,
      publicId: asset.publicId,
      storageKey: asset.storageKey,
      status: "downloaded",
      relativePath: resolveAssetRelativePath(asset),
      sizeBytes: input.assets?.[index]?.content.byteLength ?? 0,
      sha256: createHash("sha256").update(input.assets?.[index]?.content ?? Buffer.alloc(0)).digest("hex"),
      durationMs: 1,
    })),
  });

  for (const assetEntry of input.assets ?? []) {
    const relativePath = resolveAssetRelativePath(assetEntry.asset);
    const assetPath = join(resolveAssetsRootDir(workspaceDir), relativePath.replace(/^assets\//, ""));
    ensureDir(dirname(assetPath));
    writeFileSync(assetPath, assetEntry.content);
  }

  await createPackageBuildStage(createDefaultPackageBuildDependencies()).execute(
    createBackupContext(createBackupConfig({ jobId: "job-package-fixture", workspaceDir }))
  );

  return {
    zipPath: resolveBackupZipPath(workspaceDir),
    manifest: JSON.parse(readFileSync(resolvePackageManifestPath(workspaceDir), "utf8")) as PackageManifest,
  };
};

const createMockRestoreDeps = (input?: {
  restorer?: DatabaseCollectionRestorer;
}): RestoreEngineDependencies => {
  const restorer = input?.restorer ?? createTestInMemoryDatabaseRestorer();

  return {
    validation: {
      statFile: async (filePath) => stat(filePath),
      computeSha256: async (filePath) =>
        createHash("sha256").update(readFileSync(filePath)).digest("hex"),
      readZipManifest: {
        readManifest: async (zipPath) => {
          const unzipper = (await import("unzipper")).default;
          const directory = await unzipper.Open.file(zipPath);
          const entry = directory.files.find((file) => file.path === "metadata/manifest.json");
          if (!entry) throw new Error("RESTORE_PACKAGE_MANIFEST_MISSING");
          return JSON.parse((await entry.buffer()).toString("utf8")) as PackageManifest;
        },
      },
    },
    ensureDirectory: async (directoryPath) => {
      await mkdir(directoryPath, { recursive: true });
    },
    extractor: {
      extract: async ({ zipPath, destinationDir }) => {
        const unzipper = (await import("unzipper")).default;
        const directory = await unzipper.Open.file(zipPath);
        for (const entry of directory.files) {
          if (entry.type === "Directory") continue;
          const destinationPath = join(destinationDir, entry.path);
          await mkdir(dirname(destinationPath), { recursive: true });
          await writeFile(destinationPath, await entry.buffer());
        }
      },
    },
    pathExists: async (filePath) => {
      try {
        await stat(filePath);
        return true;
      } catch {
        return false;
      }
    },
    readFile: async (filePath) => readFileSync(filePath),
    readJsonFile: async (filePath) => JSON.parse(readFileSync(filePath, "utf8")),
    writeRestoreReport: async (reportPath, report) => {
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    },
    database: {
      readFile: async (filePath) => readFileSync(filePath),
      pathExists: async (filePath) => {
        try {
          await stat(filePath);
          return true;
        } catch {
          return false;
        }
      },
      readDatabaseManifest: async (manifestPath) => JSON.parse(readFileSync(manifestPath, "utf8")),
      restorer,
    },
    assets: {
      readStorageManifest: async (manifestPath) => JSON.parse(readFileSync(manifestPath, "utf8")),
      pathExists: async (filePath) => {
        try {
          await stat(filePath);
          return true;
        } catch {
          return false;
        }
      },
    },
    restoreR2Objects: async () => ({
      skipped: true,
      restored: 0,
      failed: 0,
      skippedCount: 0,
      entries: [],
    }),
  };
};

const collectLogEvents = (): { events: string[]; restore: () => void } => {
  const events: string[] = [];
  const infoSpy = vi.spyOn(console, "info").mockImplementation((message: unknown) => {
    events.push(String(message));
  });
  return { events, restore: () => infoSpy.mockRestore() };
};

describe("DR.BACKUP.V2.7 — restore engine", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("restores a valid V2 package end-to-end", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    const asset = buildAsset({
      objectId: "cloudinary:image:logo@1",
      publicId: "logo",
      storageKey: "cloudinary://image/logo",
    });

    const { zipPath, manifest } = await buildValidPackageFixture({
      workspaceDir,
      collections: {
        users: [{ _id: "1", name: "Ada" }],
      },
      assets: [{ asset, content: Buffer.from("image") }],
    });

    const restorer = createTestInMemoryDatabaseRestorer();
    const provider = createCloudinaryAssetRestoreProvider({
      restoreAsset: async ({ publicId, resourceType }) => ({
        provider: "cloudinary",
        publicId,
        storageKey: buildCloudinaryStorageKey(resourceType, publicId),
      }),
    });

    const result = await executeRestore(
      createRestoreConfig({ jobId: "job-restore", workspaceDir }),
      provider,
      createMockRestoreDeps({ restorer })
    );

    expect(result.success).toBe(true);
    expect(existsSync(resolveRestoreReportPath(workspaceDir))).toBe(true);
    expect(restorer.getRestored().get("users")).toHaveLength(1);
    expect(existsSync(zipPath)).toBe(true);
    expect(readFileSync(zipPath).byteLength).toBe(manifest.package.size);
  });

  it("rejects incompatible package versions", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await buildValidPackageFixture({ workspaceDir });

    const manifestPath = resolvePackageManifestPath(workspaceDir);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
    writeJsonFileSync(manifestPath, { ...manifest, version: 1 });

    await expect(
      validateRestorePackage({
        backupZipPath: resolveBackupZipPath(workspaceDir),
        deps: createMockRestoreDeps().validation,
        authoritativeManifestPath: manifestPath,
        readAuthoritativeManifest: async (path) => JSON.parse(readFileSync(path, "utf8")),
      })
    ).rejects.toThrow(/RESTORE_PACKAGE_VERSION_MISMATCH/);
  });

  it("rejects checksum mismatches before extraction", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await buildValidPackageFixture({ workspaceDir });

    const manifestPath = resolvePackageManifestPath(workspaceDir);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
    writeJsonFileSync(manifestPath, {
      ...manifest,
      package: {
        ...manifest.package,
        sha256: "0".repeat(64),
      },
    });

    await expect(
      executeRestore(
        createRestoreConfig({ jobId: "job-checksum", workspaceDir }),
        createCloudinaryAssetRestoreProvider({
          restoreAsset: async ({ publicId, resourceType }) => ({
            provider: "cloudinary",
            publicId,
            storageKey: buildCloudinaryStorageKey(resourceType, publicId),
          }),
        }),
        createMockRestoreDeps()
      )
    ).rejects.toThrow(/RESTORE_PACKAGE_CHECKSUM_MISMATCH/);
  });

  it("rejects packages with missing manifests after extraction", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const extractedRootDir = join(workspaceDir, "restore");
    ensureDir(join(extractedRootDir, "metadata"));
    writeJsonFileSync(join(extractedRootDir, "metadata", "manifest.json"), {});

    await expect(
      validateRestoreManifests({
        extractedRootDir,
        pathExists: createMockRestoreDeps().pathExists,
      })
    ).rejects.toThrow(/RESTORE_MANIFESTS_MISSING/);
  });

  it("restores database collections independently and continues after failure", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const extractedRootDir = join(workspaceDir, "restore");
    ensureDir(join(extractedRootDir, "metadata"));
    ensureDir(join(extractedRootDir, "database", "collections"));

    writeJsonFileSync(join(extractedRootDir, "metadata", "database-manifest.json"), {
      version: 2,
      database: {
        collectionCount: 2,
        documentCount: 2,
        exportedCollections: [{ name: "alpha" }, { name: "broken" }],
        failedCollections: [],
      },
    });

    writeFileSync(
      join(extractedRootDir, "database", "collections", "alpha.bson"),
      serializeDocumentsToBsonFile([{ _id: "1" }])
    );
    writeFileSync(join(extractedRootDir, "database", "collections", "broken.bson"), Buffer.from("bad"));

    const restorer = createTestInMemoryDatabaseRestorer();
    const context = createRestoreContext(createRestoreConfig({ jobId: "job-db", workspaceDir }));

    const results = await restoreDatabaseCollections({
      context,
      extractedRootDir,
      databaseManifestPath: join(extractedRootDir, "metadata", "database-manifest.json"),
      deps: createMockRestoreDeps({ restorer }).database,
    });

    expect(results.find((entry) => entry.name === "alpha")?.status).toBe("restored");
    expect(results.find((entry) => entry.name === "broken")?.status).toBe("failed");
    expect(restorer.getRestored().get("alpha")).toHaveLength(1);
  });

  it("restores assets independently with skipped and failed terminal states", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const extractedRootDir = join(workspaceDir, "restore");
    const restoredAsset = buildAsset({
      objectId: "ok",
      publicId: "ok",
      storageKey: "cloudinary://image/ok",
    });
    const missingAsset = buildAsset({
      objectId: "missing",
      publicId: "missing",
      storageKey: "cloudinary://image/missing",
    });
    const failedAsset = buildAsset({
      objectId: "fail",
      publicId: "fail",
      storageKey: "cloudinary://image/fail",
    });

    ensureDir(join(extractedRootDir, "metadata"));
    writeJsonFileSync(join(extractedRootDir, "metadata", "storage-manifest.json"), {
      version: 2,
      generatedAt: new Date().toISOString(),
      objectCount: 3,
      totalBytes: 0,
      objects: [restoredAsset, missingAsset, failedAsset],
      duplicateWarnings: [],
      providerSummaries: [],
    });

    ensureDir(dirname(join(extractedRootDir, resolveAssetRelativePath(restoredAsset))));
    writeFileSync(
      join(extractedRootDir, resolveAssetRelativePath(restoredAsset)),
      Buffer.from("ok")
    );
    ensureDir(dirname(join(extractedRootDir, resolveAssetRelativePath(failedAsset))));
    writeFileSync(
      join(extractedRootDir, resolveAssetRelativePath(failedAsset)),
      Buffer.from("fail")
    );

    const provider = createCloudinaryAssetRestoreProvider({
      restoreAsset: async ({ publicId, resourceType }) => {
        if (publicId === "fail") {
          throw new Error("UPLOAD_FAILED");
        }
        return {
          provider: "cloudinary",
          publicId,
          storageKey: buildCloudinaryStorageKey(resourceType, publicId),
        };
      },
    });

    const results = await restoreAssets({
      context: createRestoreContext(createRestoreConfig({ jobId: "job-assets", workspaceDir })),
      extractedRootDir,
      storageManifestPath: join(extractedRootDir, "metadata", "storage-manifest.json"),
      provider,
      deps: createMockRestoreDeps().assets,
    });

    expect(results.find((entry) => entry.objectId === "ok")?.status).toBe("restored");
    expect(results.find((entry) => entry.objectId === "missing")?.status).toBe("skipped");
    expect(results.find((entry) => entry.objectId === "fail")?.status).toBe("failed");
  });

  it("generates restore-report.json for partial restores", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await buildValidPackageFixture({
      workspaceDir,
      collections: {
        users: [{ _id: "1" }],
        broken: [{ _id: "2" }],
      },
    });

    const restorer = {
      restoreCollection: async ({ collectionName }: { collectionName: string }) => {
        if (collectionName === "broken") {
          throw new Error("RESTORE_FAILED");
        }
      },
    };

    const result = await executeRestore(
      createRestoreConfig({ jobId: "job-partial", workspaceDir }),
      createCloudinaryAssetRestoreProvider({
        restoreAsset: async () => ({
          provider: "cloudinary",
          publicId: "x",
          storageKey: "cloudinary://image/x",
        }),
      }),
      createMockRestoreDeps({ restorer: restorer as DatabaseCollectionRestorer })
    );

    expect(result.success).toBe(false);
    const report = JSON.parse(
      readFileSync(resolveRestoreReportPath(workspaceDir), "utf8")
    ) as RestoreReport;
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.collections.some((entry) => entry.status === "failed")).toBe(true);
  });

  it("uses the provider abstraction for Cloudinary asset restore", async () => {
    const provider = createCloudinaryAssetRestoreProvider({
      restoreAsset: async ({ publicId, resourceType }) => ({
        provider: "cloudinary",
        publicId,
        storageKey: buildCloudinaryStorageKey(resourceType, publicId),
      }),
    });

    const asset = buildAsset({
      objectId: "1",
      publicId: "photo",
      storageKey: "cloudinary://image/photo",
    });

    const result = await provider.restore({
      asset,
      localFilePath: "/tmp/unused",
      context: createRestoreContext(createRestoreConfig({ jobId: "job-provider", workspaceDir: "/tmp" })),
    });

    expect(result.publicId).toBe("photo");
  });

  it("emits required restore lifecycle logs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    await buildValidPackageFixture({
      workspaceDir,
      collections: { users: [{ _id: "1" }] },
    });

    const { events, restore } = collectLogEvents();

    await createRestoreEngine(
      createCloudinaryAssetRestoreProvider({
        restoreAsset: async ({ publicId, resourceType }) => ({
          provider: "cloudinary",
          publicId,
          storageKey: buildCloudinaryStorageKey(resourceType, publicId),
        }),
      }),
      createMockRestoreDeps({ restorer: createTestInMemoryDatabaseRestorer() })
    ).run(createRestoreConfig({ jobId: "job-logs", workspaceDir }));

    restore();

    for (const event of [
      "RESTORE_STAGE_STARTED",
      "PACKAGE_VALIDATED",
      "PACKAGE_EXTRACTED",
      "DATABASE_RESTORE_STARTED",
      "DATABASE_COLLECTION_RESTORED",
      "ASSET_RESTORE_STARTED",
      "RESTORE_VERIFIED",
      "RESTORE_STAGE_COMPLETED",
    ]) {
      expect(events.some((line) => line.includes(`[DR.V2] ${event}`))).toBe(true);
    }
  });
});

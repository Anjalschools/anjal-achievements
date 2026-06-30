import { createHash } from "crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { describe, expect, it, vi, afterEach } from "vitest";

import {
  discoverR2ObjectsFromBsonFile,
  discoverR2ObjectsInDocument,
  isBackupArtifactKey,
} from "@/lib/disaster-recovery-v2/object-storage/r2-discovery";
import {
  buildR2Manifest,
  parseR2Manifest,
  resolveR2AssetRelativePath,
  summarizeR2ManifestForPackage,
} from "@/lib/disaster-recovery-v2/object-storage/r2-manifest";
import { exportR2ObjectsFromManifest } from "@/lib/disaster-recovery-v2/object-storage/r2-export";
import { restoreR2ObjectsFromManifest } from "@/lib/disaster-recovery-v2/object-storage/r2-restore";
import { executeR2ObjectRestoreStage } from "@/lib/disaster-recovery-v2/package/dr-streaming-restore";
import { createPackageBuildStageWithR2Export, executeR2ObjectExportStage } from "@/lib/disaster-recovery-v2/package/dr-streaming-backup";
import { createDefaultPackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { resolveDatabaseCollectionsDir, resolveDatabaseManifestPath } from "@/lib/disaster-recovery-v2/database/database-paths";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import { serializeDocumentsToBsonFile } from "@/lib/disaster-recovery-v2/restore/parse-bson-collection";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

vi.mock("@/lib/disaster-recovery-v2/production/v2-production-progress", () => ({
  persistV2ProductionProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/r2", () => ({
  getR2BucketName: () => "test-bucket",
  getR2Client: () => ({}),
  isR2Configured: () => true,
}));

const mockGetObject = vi.fn();
const mockPutObject = vi.fn(async ({ body }) => {
  if (body && typeof (body as Readable).pipe === "function") {
    const stream = body as Readable;
    await new Promise<void>((resolve, reject) => {
      stream.on("end", () => resolve());
      stream.on("error", reject);
      stream.resume();
    });
  }
  return { ETag: "etag" };
});

vi.mock("@/lib/disaster-recovery-v2/object-storage/r2-client", () => ({
  getConfiguredR2BucketName: () => "test-bucket",
  fetchR2ObjectStream: (input: { key: string }) => mockGetObject(input),
  uploadR2ObjectStream: (input: { key: string; body: unknown; contentType: string }) =>
    mockPutObject(input),
}));

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-r2-"));

describe("DR.BACKUP.V2.11 — Cloudflare R2 object storage", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    mockGetObject.mockReset();
    mockPutObject.mockClear();
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("discovers R2 references from nested storage objects only", () => {
    const objects = discoverR2ObjectsInDocument({
      collection: "achievements",
      defaultBucket: "test-bucket",
      document: {
        _id: "ach-1",
        attachments: [
          { provider: "r2", key: "achievements/attachments/file.pdf", mimeType: "application/pdf" },
        ],
        image: "training/cover.png",
        metadata: {
          key: "query/trainingcompletionrecords:student_success_training_by_student",
        },
      },
    });

    expect(objects).toHaveLength(1);
    expect(objects[0]?.key).toBe("achievements/attachments/file.pdf");
  });

  it("discovers valid storage references and ignores false-positive strings (V2.11.B)", () => {
    const discovered = discoverR2ObjectsInDocument({
      collection: "training",
      defaultBucket: "anjal-achievements-files",
      document: {
        _id: "doc-refs",
        providerObject: {
          provider: "r2",
          key: "achievements/attachments/file.pdf",
        },
        bucketObject: {
          bucket: "anjal-achievements-files",
          key: "training/video.mp4",
        },
        storageKeyObject: {
          storageKey: "partnerships/logo.png",
        },
        legacyImageKey: {
          imageKey: "achievements/attachments/legacy-cover.jpg",
        },
        ignoredValues: {
          queryKey: "query/trainingcompletionrecords:student_success_training_by_student",
          trainingPath: "training/student_success",
          httpUrl: "https://example.com/file.pdf",
          dataUrl: "data:image/png;base64,abc",
          random: "random/string/value",
          bareKey: { key: "training/student_success" },
        },
      },
    });

    expect(discovered.map((entry) => entry.key).sort()).toEqual([
      "achievements/attachments/file.pdf",
      "achievements/attachments/legacy-cover.jpg",
      "partnerships/logo.png",
      "training/video.mp4",
    ]);
  });

  it("excludes backup artifact keys from R2 discovery (V2.11.E)", () => {
    expect(isBackupArtifactKey("dr-v2/backups/job-1/backup.zip")).toBe(true);
    expect(isBackupArtifactKey("/dr-v2/backups/job-1/backup.zip")).toBe(true);
    expect(isBackupArtifactKey("backups/2026-06-18/123-backup.zip")).toBe(true);
    expect(isBackupArtifactKey("achievements/attachments/file.pdf")).toBe(false);
    expect(isBackupArtifactKey("training/video.mp4")).toBe(false);
    expect(isBackupArtifactKey("partnerships/logo.png")).toBe(false);

    const discovered = discoverR2ObjectsInDocument({
      collection: "backuprecords",
      defaultBucket: "test-bucket",
      document: {
        _id: "rec-1",
        drArtifact: {
          provider: "r2",
          key: "dr-v2/backups/job-upload/backup.zip",
          mimeType: "application/zip",
        },
        operational: {
          provider: "r2",
          key: "achievements/attachments/evidence.pdf",
          mimeType: "application/pdf",
        },
        legacyBackup: {
          storageKey: "backups/2026-06-18/manual.zip",
        },
      },
    });

    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.key).toBe("achievements/attachments/evidence.pdf");
  });

  it("discovers R2 references from exported BSON collections", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const collectionsDir = resolveDatabaseCollectionsDir(workspaceDir);
    await mkdir(collectionsDir, { recursive: true });

    const bson = serializeDocumentsToBsonFile([
      {
        _id: "doc-1",
        evidence: {
          provider: "r2",
          key: "partnerships/evidence/report.pdf",
          bucket: "custom-bucket",
        },
      },
    ]);
    await writeFile(join(collectionsDir, "applications.bson"), bson);

    const discovered = await discoverR2ObjectsFromBsonFile({
      collectionName: "applications",
      bsonFilePath: join(collectionsDir, "applications.bson"),
      defaultBucket: "test-bucket",
    });

    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.bucket).toBe("custom-bucket");
    expect(discovered[0]?.collection).toBe("applications");
  });

  it("builds r2-manifest metadata with relative asset paths", () => {
    const manifest = buildR2Manifest([
      {
        key: "training/report.pdf",
        bucket: "test-bucket",
        mimeType: "application/pdf",
        collection: "training",
        documentId: "doc-1",
      },
    ]);

    expect(manifest.version).toBe(1);
    expect(manifest.objects[0]?.relativePath).toBe(resolveR2AssetRelativePath("training/report.pdf"));
    expect(summarizeR2ManifestForPackage(manifest)).toBeUndefined();
  });

  it("exports R2 objects using streaming without loading full buffers", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const payload = Buffer.alloc(1024 * 256, 7);
    const expectedSha = createHash("sha256").update(payload).digest("hex");

    const getObject = vi.fn(async () => ({
      Body: Readable.from(payload),
    }));

    const manifest = buildR2Manifest([
      {
        key: "training/large.bin",
        bucket: "test-bucket",
        mimeType: "application/octet-stream",
        collection: "training",
        documentId: "doc-1",
        sha256: expectedSha,
      },
    ]);

    const result = await exportR2ObjectsFromManifest(manifest, {
      workspaceDir,
      jobId: "job-r2-export",
      getObject,
    });

    expect(result.exported).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.manifest.verified).toBe(true);
    expect(getObject).toHaveBeenCalledWith({ key: "training/large.bin" });

    const exportedPath = join(workspaceDir, "assets/r2/training/large.bin");
    expect(existsSync(exportedPath)).toBe(true);
    const exportedBytes = readFileSync(exportedPath);
    expect(exportedBytes.byteLength).toBe(payload.byteLength);
    expect(createHash("sha256").update(exportedBytes).digest("hex")).toBe(expectedSha);
  });

  it("restores R2 objects from extracted package assets", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const relativePath = resolveR2AssetRelativePath("training/report.pdf");
    const absolutePath = join(workspaceDir, relativePath);
    await mkdir(join(workspaceDir, "assets/r2/training"), { recursive: true });
    await writeFile(absolutePath, Buffer.from("pdf-content"));

    const manifest = buildR2Manifest([
      {
        key: "training/report.pdf",
        bucket: "test-bucket",
        mimeType: "application/pdf",
        collection: "training",
        documentId: "doc-1",
      },
    ]);
    manifest.objects[0]!.status = "exported";

    const result = await restoreR2ObjectsFromManifest(manifest, {
      extractedRootDir: workspaceDir,
      jobId: "job-r2-restore",
    });

    expect(result.restored).toBe(1);
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    expect(mockPutObject.mock.calls[0]?.[0]?.key).toBe("training/report.pdf");
  });

  it("skips R2 restore when r2-manifest is missing (legacy backups)", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);

    const result = await executeR2ObjectRestoreStage({
      extractedRootDir: workspaceDir,
      jobId: "legacy-restore",
    });

    expect(result.skipped).toBe(true);
    expect(result.restored).toBe(0);
  });

  it("skips R2 export when database export has no R2 references", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const collectionsDir = resolveDatabaseCollectionsDir(workspaceDir);
    await mkdir(collectionsDir, { recursive: true });
    await writeFile(
      join(collectionsDir, "users.bson"),
      serializeDocumentsToBsonFile([{ _id: "u1", name: "No files" }])
    );

    const context = createBackupContext(
      createBackupConfig({ jobId: "job-no-r2", workspaceDir })
    );
    const deps = createDefaultPackageBuildDependencies();

    await executeR2ObjectExportStage(context, deps);

    expect(context.artifacts.r2Export).toMatchObject({
      skipped: true,
      objectCount: 0,
    });
    expect(existsSync(join(workspaceDir, "metadata/r2-manifest.json"))).toBe(false);
  });

  it("packages R2 manifest and assets through package build with R2 export wrapper", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const collectionsDir = resolveDatabaseCollectionsDir(workspaceDir);
    await mkdir(collectionsDir, { recursive: true });
    await mkdir(join(workspaceDir, "metadata"), { recursive: true });
    await mkdir(join(workspaceDir, "storage"), { recursive: true });

    await writeFile(
      join(collectionsDir, "training.bson"),
      serializeDocumentsToBsonFile([
        {
          _id: "doc-1",
          file: {
            provider: "r2",
            key: "training/report.pdf",
            mimeType: "application/pdf",
          },
        },
      ])
    );

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

    const payload = Buffer.from("pdf-content");
    mockGetObject.mockResolvedValue({
      Body: Readable.from(payload),
    });

    const stage = createPackageBuildStageWithR2Export(createDefaultPackageBuildDependencies());
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-package-r2", workspaceDir })
    );
    const result = await stage.execute(context);

    expect(result.success).toBe(true);

    const manifestRaw = JSON.parse(
      await readFile(join(workspaceDir, "metadata/r2-manifest.json"), "utf8")
    );
    const r2Manifest = parseR2Manifest(manifestRaw);
    expect(r2Manifest?.objects[0]?.status).toBe("exported");
    expect(existsSync(join(workspaceDir, "assets/r2/training/report.pdf"))).toBe(true);
    expect(summarizeR2ManifestForPackage(r2Manifest)).toEqual({
      providers: ["cloudinary", "r2"],
      objects: 1,
      bytes: payload.byteLength,
    });
  });
});

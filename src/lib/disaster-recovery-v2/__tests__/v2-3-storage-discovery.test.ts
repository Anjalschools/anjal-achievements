import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi, afterEach } from "vitest";

import {
  createStorageDiscoveryStage,
  executeStorageDiscoveryStage,
} from "@/lib/disaster-recovery-v2/storage/create-storage-discovery-stage";
import { detectDuplicateStorageKeys } from "@/lib/disaster-recovery-v2/storage/detect-duplicate-storage-keys";
import { compareStorageDiscoveryAssets, sortStorageDiscoveryAssets } from "@/lib/disaster-recovery-v2/storage/sort-storage-assets";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import type { StorageDiscoveryAsset, StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { StorageDiscoveryDependencies } from "@/lib/disaster-recovery-v2/storage/storage-discovery-dependencies";
import type { StorageProvider } from "@/lib/disaster-recovery-v2/storage/storage-provider";
import { createCloudinaryStorageProvider } from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-storage-provider";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-storage-"));

const buildAsset = (overrides: Partial<StorageDiscoveryAsset> & Pick<StorageDiscoveryAsset, "objectId" | "publicId" | "storageKey">): StorageDiscoveryAsset => ({
  provider: "cloudinary",
  checksumAvailable: false,
  ...overrides,
});

const createMockProvider = (input: {
  id: string;
  required?: boolean;
  assets?: StorageDiscoveryAsset[];
  fail?: boolean;
  onDiscover?: () => void;
}): StorageProvider => ({
  id: input.id,
  required: input.required ?? true,
  discover: async () => {
    input.onDiscover?.();
    if (input.fail) {
      throw new Error(`PROVIDER_FAILED:${input.id}`);
    }
    return {
      provider: input.id,
      assets: input.assets ?? [],
    };
  },
});

const createMockDeps = (workspaceDir: string): StorageDiscoveryDependencies => ({
  ensureStorageDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeManifest: async (manifestPath, manifest) => {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  },
});

const readManifest = (workspaceDir: string): StorageManifest =>
  JSON.parse(readFileSync(resolveStorageManifestPath(workspaceDir), "utf8")) as StorageManifest;

const collectLogEvents = (): { events: string[]; restore: () => void } => {
  const events: string[] = [];
  const infoSpy = vi.spyOn(console, "info").mockImplementation((message: unknown) => {
    events.push(String(message));
  });
  return {
    events,
    restore: () => infoSpy.mockRestore(),
  };
};

describe("DR.BACKUP.V2.3 — storage discovery stage", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("generates an empty manifest when a provider returns no assets", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const providers = [createMockProvider({ id: "cloudinary", assets: [] })];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-empty", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(result.success).toBe(true);
    const manifest = readManifest(workspaceDir);
    expect(manifest.version).toBe(2);
    expect(manifest.objectCount).toBe(0);
    expect(manifest.objects).toEqual([]);
    expect(manifest.providerSummaries).toHaveLength(1);
    expect(manifest.providerSummaries[0].success).toBe(true);
  });

  it("discovers a single asset", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const asset = buildAsset({
      objectId: "cloudinary:image:alpha@1",
      publicId: "alpha",
      storageKey: "cloudinary://image/alpha",
      bytes: 1200,
    });
    const providers = [createMockProvider({ id: "cloudinary", assets: [asset] })];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-single", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(result.success).toBe(true);
    const manifest = readManifest(workspaceDir);
    expect(manifest.objectCount).toBe(1);
    expect(manifest.objects[0]).toMatchObject({
      objectId: "cloudinary:image:alpha@1",
      provider: "cloudinary",
      publicId: "alpha",
      storageKey: "cloudinary://image/alpha",
      bytes: 1200,
    });
    expect(context.artifacts.storageInventory).toMatchObject({
      manifestPath: resolveStorageManifestPath(workspaceDir),
    });
  });

  it("discovers multiple assets from multiple providers", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const providers = [
      createMockProvider({
        id: "cloudinary",
        assets: [
          buildAsset({
            objectId: "cloudinary:image:z/file@1",
            publicId: "z/file",
            storageKey: "cloudinary://image/z/file",
            folder: "z",
          }),
          buildAsset({
            objectId: "cloudinary:image:a/file@1",
            publicId: "a/file",
            storageKey: "cloudinary://image/a/file",
            folder: "a",
          }),
        ],
      }),
      createMockProvider({
        id: "r2",
        required: false,
        assets: [
          buildAsset({
            objectId: "r2:object:backup@1",
            provider: "r2",
            publicId: "backup",
            storageKey: "r2://bucket/backup",
          }),
        ],
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-multi", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(result.success).toBe(true);
    const manifest = readManifest(workspaceDir);
    expect(manifest.objectCount).toBe(3);
    expect(manifest.objects.map((entry) => entry.storageKey)).toEqual([
      "cloudinary://image/a/file",
      "cloudinary://image/z/file",
      "r2://bucket/backup",
    ]);
  });

  it("orders assets deterministically by provider, folder, publicId, and storageKey", () => {
    const assets = sortStorageDiscoveryAssets([
      buildAsset({
        objectId: "2",
        provider: "cloudinary",
        publicId: "z/file",
        storageKey: "cloudinary://image/z/file",
        folder: "z",
      }),
      buildAsset({
        objectId: "1",
        provider: "cloudinary",
        publicId: "a/file",
        storageKey: "cloudinary://image/a/file",
        folder: "a",
      }),
      buildAsset({
        objectId: "3",
        provider: "r2",
        publicId: "backup",
        storageKey: "r2://bucket/backup",
      }),
      buildAsset({
        objectId: "4",
        provider: "cloudinary",
        publicId: "a/file-alt",
        storageKey: "cloudinary://image/a/file-alt",
        folder: "a",
      }),
    ]);

    expect(assets.map((entry) => entry.objectId)).toEqual(["1", "4", "2", "3"]);
    expect(compareStorageDiscoveryAssets(assets[0], assets[1])).toBeLessThan(0);
  });

  it("detects duplicate storage keys and records warnings without aborting", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const duplicateKey = "cloudinary://image/shared";
    const providers = [
      createMockProvider({
        id: "cloudinary",
        assets: [
          buildAsset({
            objectId: "cloudinary:image:shared@1",
            publicId: "shared",
            storageKey: duplicateKey,
          }),
          buildAsset({
            objectId: "cloudinary:image:shared@2",
            publicId: "shared",
            storageKey: duplicateKey,
            version: 2,
          }),
        ],
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-duplicates", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(result.success).toBe(true);
    expect(result.warnings.some((warning) => warning.code === "STORAGE_DUPLICATE_DETECTED")).toBe(
      true
    );

    const manifest = readManifest(workspaceDir);
    expect(manifest.duplicateWarnings).toHaveLength(1);
    expect(manifest.duplicateWarnings[0]).toEqual({
      storageKey: duplicateKey,
      objectIds: ["cloudinary:image:shared@1", "cloudinary:image:shared@2"],
    });

    expect(detectDuplicateStorageKeys(manifest.objects)).toEqual(manifest.duplicateWarnings);
  });

  it("continues after a provider failure and returns stage failure for required providers", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const providers = [
      createMockProvider({
        id: "cloudinary",
        required: true,
        fail: true,
      }),
      createMockProvider({
        id: "r2",
        required: false,
        assets: [
          buildAsset({
            objectId: "r2:object:kept@1",
            provider: "r2",
            publicId: "kept",
            storageKey: "r2://bucket/kept",
          }),
        ],
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-provider-fail", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);

    const manifest = readManifest(workspaceDir);
    expect(manifest.providerSummaries).toHaveLength(2);
    expect(manifest.providerSummaries.find((entry) => entry.provider === "cloudinary")?.success).toBe(
      false
    );
    expect(manifest.providerSummaries.find((entry) => entry.provider === "r2")?.success).toBe(true);
    expect(manifest.objects).toHaveLength(1);
    expect(existsSync(resolveStorageManifestPath(workspaceDir))).toBe(true);
  });

  it("succeeds when only optional providers fail", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const providers = [
      createMockProvider({
        id: "cloudinary",
        assets: [
          buildAsset({
            objectId: "cloudinary:image:ok@1",
            publicId: "ok",
            storageKey: "cloudinary://image/ok",
          }),
        ],
      }),
      createMockProvider({
        id: "r2",
        required: false,
        fail: true,
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-optional-fail", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(result.success).toBe(true);
    expect(readManifest(workspaceDir).objects).toHaveLength(1);
  });

  it("writes storage-manifest.json without creating downloaded assets", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const providers = [
      createMockProvider({
        id: "cloudinary",
        assets: [
          buildAsset({
            objectId: "cloudinary:image:only-manifest@1",
            publicId: "only-manifest",
            storageKey: "cloudinary://image/only-manifest",
            downloadUrl: "https://res.cloudinary.com/demo/image/upload/v1/only-manifest.jpg",
          }),
        ],
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-manifest", workspaceDir })
    );

    await executeStorageDiscoveryStage(context, providers, createMockDeps(workspaceDir));

    expect(existsSync(resolveStorageManifestPath(workspaceDir))).toBe(true);
    expect(existsSync(join(workspaceDir, "storage", "only-manifest"))).toBe(false);
    expect(existsSync(join(workspaceDir, "storage", "collections"))).toBe(false);
  });

  it("isolates providers so one failure does not block another", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const discoveryOrder: string[] = [];
    const providers = [
      createMockProvider({
        id: "cloudinary",
        required: false,
        fail: true,
        onDiscover: () => {
          discoveryOrder.push("cloudinary");
        },
      }),
      createMockProvider({
        id: "r2",
        required: true,
        onDiscover: () => {
          discoveryOrder.push("r2");
        },
        assets: [
          buildAsset({
            objectId: "r2:object:after-failure@1",
            provider: "r2",
            publicId: "after-failure",
            storageKey: "r2://bucket/after-failure",
          }),
        ],
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-isolation", workspaceDir })
    );

    const result = await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(
      context
    );

    expect(discoveryOrder).toEqual(["cloudinary", "r2"]);
    expect(result.success).toBe(true);
  });

  it("emits required storage discovery lifecycle logs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const duplicateKey = "cloudinary://image/dup";
    const providers = [
      createMockProvider({
        id: "cloudinary",
        assets: [
          buildAsset({
            objectId: "cloudinary:image:dup@1",
            publicId: "dup",
            storageKey: duplicateKey,
          }),
          buildAsset({
            objectId: "cloudinary:image:dup@2",
            publicId: "dup",
            storageKey: duplicateKey,
          }),
        ],
      }),
    ];
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-logs", workspaceDir })
    );
    const { events, restore } = collectLogEvents();

    await createStorageDiscoveryStage(providers, createMockDeps(workspaceDir)).execute(context);
    restore();

    for (const event of [
      "STORAGE_PROVIDER_STARTED",
      "STORAGE_PROVIDER_COMPLETED",
      "STORAGE_DUPLICATE_DETECTED",
      "STORAGE_DISCOVERY_COMPLETED",
    ]) {
      expect(events.some((line) => line.includes(`[DR.V2] ${event}`))).toBe(true);
    }
  });

  it("maps Cloudinary resources through the provider adapter", async () => {
    const provider = createCloudinaryStorageProvider({
      listResources: async ({ resourceType, nextCursor }) => {
        if (resourceType === "image" && !nextCursor) {
          return {
            resources: [
              {
                public_id: "folder/photo",
                resource_type: "image",
                format: "jpg",
                version: 42,
                bytes: 2048,
                created_at: "2024-01-01T00:00:00Z",
                secure_url: "https://res.cloudinary.com/demo/image/upload/v42/folder/photo.jpg",
                tags: ["b", "a"],
              },
            ],
          };
        }
        return { resources: [] };
      },
    });

    const result = await provider.discover(
      createBackupContext(createBackupConfig({ jobId: "job-cloudinary", workspaceDir: "/tmp/x" }))
    );

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      provider: "cloudinary",
      publicId: "folder/photo",
      storageKey: "cloudinary://image/folder/photo",
      folder: "folder",
      version: 42,
      bytes: 2048,
      checksumAvailable: false,
      tags: ["a", "b"],
    });
  });

  it("excludes Cloudinary sample assets before manifest creation", async () => {
    const provider = createCloudinaryStorageProvider({
      listResources: async ({ resourceType, nextCursor }) => {
        if (resourceType === "image" && !nextCursor) {
          return {
            resources: [
              {
                public_id: "achievements/logo",
                resource_type: "image",
                secure_url: "https://res.cloudinary.com/demo/image/upload/achievements/logo.jpg",
              },
              {
                public_id: "samples/paper",
                resource_type: "image",
                secure_url: "https://res.cloudinary.com/demo/image/upload/samples/paper.jpg",
              },
              {
                public_id: "samples/cloudinary-logo-vector",
                resource_type: "image",
                secure_url:
                  "https://res.cloudinary.com/demo/image/upload/samples/cloudinary-logo-vector.svg",
              },
              {
                public_id: "samples/ecommerce/accessories-bag",
                resource_type: "image",
                secure_url:
                  "https://res.cloudinary.com/demo/image/upload/samples/ecommerce/accessories-bag.jpg",
              },
            ],
          };
        }

        if (resourceType === "video" && !nextCursor) {
          return {
            resources: [
              {
                public_id: "samples/video/sea-turtle",
                resource_type: "video",
                secure_url: "https://res.cloudinary.com/demo/video/upload/samples/video/sea-turtle.mp4",
              },
            ],
          };
        }

        return { resources: [] };
      },
    });

    const result = await provider.discover(
      createBackupContext(createBackupConfig({ jobId: "job-cloudinary-samples", workspaceDir: "/tmp/x" }))
    );

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.publicId).toBe("achievements/logo");
    expect(result.assets.every((asset) => !asset.publicId.startsWith("samples/"))).toBe(true);
    expect(result.assets.every((asset) => !asset.storageKey.includes("/samples/"))).toBe(true);
  });

  it("emits STORAGE_SKIP_SAMPLE_ASSET debug logs when DR_DEBUG is enabled", async () => {
    vi.stubEnv("DR_DEBUG", "1");
    const { events, restore } = collectLogEvents();

    try {
      const provider = createCloudinaryStorageProvider({
        listResources: async ({ resourceType, nextCursor }) => {
          if (resourceType === "image" && !nextCursor) {
            return {
              resources: [
                {
                  public_id: "samples/radial",
                  resource_type: "image",
                  secure_url: "https://res.cloudinary.com/demo/image/upload/samples/radial.jpg",
                },
              ],
            };
          }
          return { resources: [] };
        },
      });

      await provider.discover(
        createBackupContext(createBackupConfig({ jobId: "job-cloudinary-debug", workspaceDir: "/tmp/x" }))
      );

      expect(events.some((line) => line.includes("[DR.V2] STORAGE_SKIP_SAMPLE_ASSET"))).toBe(true);
    } finally {
      restore();
      vi.unstubAllEnvs();
    }
  });
});

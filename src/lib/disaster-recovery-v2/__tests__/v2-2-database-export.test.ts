import { createHash } from "crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { mkdir, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { serialize } from "bson";

import { createDatabaseStage, executeDatabaseStage } from "@/lib/disaster-recovery-v2/database/create-database-stage";
import type { DatabaseExportDependencies } from "@/lib/disaster-recovery-v2/database/database-export-dependencies";
import {
  exportCollectionDocumentsToBsonFile,
  type CollectionDocumentCursor,
} from "@/lib/disaster-recovery-v2/database/export-collection-bson";
import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import { discoverApplicationCollectionNames, sortCollectionNames } from "@/lib/disaster-recovery-v2/database/discover-collections";
import { resolveCollectionBsonPath, resolveDatabaseManifestPath } from "@/lib/disaster-recovery-v2/database/database-paths";
import type { DatabaseManifest } from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";

type MockCollectionSpec = {
  name: string;
  documents?: Record<string, unknown>[];
  fail?: boolean;
};

const createWorkspaceDir = (): string => mkdtempSync(join(tmpdir(), "dr-v2-db-"));

const createInMemoryCursor = (
  documents: Record<string, unknown>[]
): { cursor: CollectionDocumentCursor; closeSpy: ReturnType<typeof vi.fn> } => {
  const closeSpy = vi.fn(async () => undefined);
  let index = 0;

  const cursor: CollectionDocumentCursor = {
    close: closeSpy,
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        if (index >= documents.length) {
          return { done: true, value: undefined };
        }
        const value = documents[index];
        index += 1;
        return { done: false, value };
      },
    }),
  };

  return { cursor, closeSpy };
};

const exportDocumentsToFile = async (
  outputPath: string,
  documents: Record<string, unknown>[]
): Promise<{ documentCount: number; sizeBytes: number; sha256: string; durationMs: number }> => {
  const { cursor } = createInMemoryCursor(documents);
  return exportCollectionDocumentsToBsonFile({
    outputPath,
    statFile: (filePath) => stat(filePath),
    openCursor: async () => cursor,
  });
};

const createMockDatabaseDeps = (input: {
  collections: MockCollectionSpec[];
}): {
  deps: DatabaseExportDependencies;
  closeSpies: Map<string, ReturnType<typeof vi.fn>>;
  exportOrder: string[];
} => {
  const closeSpies = new Map<string, ReturnType<typeof vi.fn>>();
  const exportOrder: string[] = [];

  const deps: DatabaseExportDependencies = {
    ensureDirectory: async (directoryPath) => {
      await mkdir(directoryPath, { recursive: true });
    },
    writeManifest: async (manifestPath, manifest) => {
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    },
    listCollections: async () =>
      input.collections.map((collection) => ({
        name: collection.name,
      })),
    exportCollection: async ({ collectionName, outputPath }) => {
      exportOrder.push(collectionName);
      const spec = input.collections.find((entry) => entry.name === collectionName);
      if (!spec) {
        throw new Error(`UNKNOWN_COLLECTION:${collectionName}`);
      }
      if (spec.fail) {
        throw new Error(`EXPORT_FAILED:${collectionName}`);
      }

      const { cursor, closeSpy } = createInMemoryCursor(spec.documents ?? []);
      closeSpies.set(collectionName, closeSpy);

      return exportCollectionDocumentsToBsonFile({
        outputPath,
        statFile: (filePath) => stat(filePath),
        openCursor: async () => cursor,
      });
    },
  };

  return { deps, closeSpies, exportOrder };
};

const readManifest = (workspaceDir: string): DatabaseManifest =>
  JSON.parse(readFileSync(resolveDatabaseManifestPath(workspaceDir), "utf8")) as DatabaseManifest;

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

describe("DR.BACKUP.V2.2 — database export stage", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("exports an empty database with an empty manifest", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { deps } = createMockDatabaseDeps({ collections: [] });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-empty", workspaceDir })
    );

    const stage = createDatabaseStage(deps);
    const result = await stage.execute(context);

    expect(result.success).toBe(true);
    expect(existsSync(resolveDatabaseManifestPath(workspaceDir))).toBe(true);

    const manifest = readManifest(workspaceDir);
    expect(manifest.version).toBe(2);
    expect(manifest.database.collectionCount).toBe(0);
    expect(manifest.database.documentCount).toBe(0);
    expect(manifest.database.exportedCollections).toEqual([]);
    expect(manifest.database.failedCollections).toEqual([]);
    expect(context.artifacts.database).toMatchObject({ manifestPath: resolveDatabaseManifestPath(workspaceDir) });
  });

  it("exports a single collection to BSON with manifest metadata", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const documents = [{ _id: "1", name: "Alpha" }, { _id: "2", name: "Beta" }];
    const { deps } = createMockDatabaseDeps({
      collections: [{ name: "users", documents }],
    });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-single", workspaceDir })
    );

    const result = await createDatabaseStage(deps).execute(context);

    expect(result.success).toBe(true);

    const bsonPath = resolveCollectionBsonPath(workspaceDir, "users");
    expect(existsSync(bsonPath)).toBe(true);

    const manifest = readManifest(workspaceDir);
    expect(manifest.database.collectionCount).toBe(1);
    expect(manifest.database.documentCount).toBe(2);
    expect(manifest.database.exportedCollections).toHaveLength(1);
    expect(manifest.database.exportedCollections[0]).toMatchObject({
      name: "users",
      documentCount: 2,
      exportedFile: "collections/users.bson",
    });
    expect(manifest.database.exportedCollections[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.database.exportedCollections[0].sizeBytes).toBeGreaterThan(0);
    expect(manifest.database.exportedCollections[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("exports multiple collections independently in deterministic order", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { deps, exportOrder } = createMockDatabaseDeps({
      collections: [
        { name: "schools", documents: [{ _id: "s1" }] },
        { name: "achievements", documents: [{ _id: "a1" }, { _id: "a2" }] },
        { name: "users", documents: [{ _id: "u1" }] },
      ],
    });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-multi", workspaceDir })
    );

    const result = await createDatabaseStage(deps).execute(context);

    expect(result.success).toBe(true);
    expect(exportOrder).toEqual(["achievements", "schools", "users"]);

    const manifest = readManifest(workspaceDir);
    expect(manifest.database.collectionCount).toBe(3);
    expect(manifest.database.documentCount).toBe(4);
    expect(manifest.database.exportedCollections.map((entry) => entry.name)).toEqual([
      "achievements",
      "schools",
      "users",
    ]);

    for (const collectionName of ["achievements", "schools", "users"]) {
      expect(existsSync(resolveCollectionBsonPath(workspaceDir, collectionName))).toBe(true);
    }
  });

  it("continues exporting after a failed collection and returns stage failure", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { deps } = createMockDatabaseDeps({
      collections: [
        { name: "alpha", documents: [{ _id: "1" }] },
        { name: "broken", fail: true },
        { name: "zeta", documents: [{ _id: "2" }, { _id: "3" }] },
      ],
    });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-failed", workspaceDir })
    );

    const result = await createDatabaseStage(deps).execute(context);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("DATABASE_COLLECTION_EXPORT_FAILED");

    const manifest = readManifest(workspaceDir);
    expect(manifest.database.failedCollections).toHaveLength(1);
    expect(manifest.database.failedCollections[0].name).toBe("broken");
    expect(manifest.database.exportedCollections).toHaveLength(2);
    expect(existsSync(resolveCollectionBsonPath(workspaceDir, "alpha"))).toBe(true);
    expect(existsSync(resolveCollectionBsonPath(workspaceDir, "zeta"))).toBe(true);
    expect(existsSync(resolveCollectionBsonPath(workspaceDir, "broken"))).toBe(false);
  });

  it("computes SHA256 after the BSON file is closed", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const outputPath = join(workspaceDir, "sample.bson");
    await mkdir(workspaceDir, { recursive: true });

    const documents = [{ _id: "doc-1", value: 42 }];
    const exportResult = await exportDocumentsToFile(outputPath, documents);
    const expectedSha256 = await computeFileSha256(outputPath);

    expect(exportResult.sha256).toBe(expectedSha256);

    const manualHash = createHash("sha256");
    const fileBuffer = readFileSync(outputPath);
    manualHash.update(fileBuffer);
    expect(exportResult.sha256).toBe(manualHash.digest("hex"));
  });

  it("writes mongodump-style length-prefixed BSON documents", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const outputPath = join(workspaceDir, "records.bson");
    await mkdir(workspaceDir, { recursive: true });

    const documents = [{ _id: "x", label: "test" }];
    await exportDocumentsToFile(outputPath, documents);

    const fileBuffer = readFileSync(outputPath);
    const documentLength = fileBuffer.readInt32LE(0);
    const documentBytes = fileBuffer.subarray(4, 4 + documentLength);

    expect(documentBytes.equals(Buffer.from(serialize(documents[0])))).toBe(true);
  });

  it("closes collection resources before exporting the next collection", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { deps, closeSpies, exportOrder } = createMockDatabaseDeps({
      collections: [
        { name: "first", documents: [{ _id: "1" }] },
        { name: "second", documents: [{ _id: "2" }] },
      ],
    });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-cleanup", workspaceDir })
    );

    await executeDatabaseStage(context, deps);

    expect(exportOrder).toEqual(["first", "second"]);
    expect(closeSpies.get("first")).toHaveBeenCalledTimes(1);
    expect(closeSpies.get("second")).toHaveBeenCalledTimes(1);
  });

  it("skips system collections during discovery", async () => {
    const names = await discoverApplicationCollectionNames(async () => [
      { name: "users" },
      { name: "system.version" },
      { name: "local.startup_log" },
      { name: "achievements" },
    ]);

    expect(names).toEqual(["achievements", "users"]);
  });

  it("sorts collection names deterministically", () => {
    expect(sortCollectionNames(["users", "achievements", "schools"])).toEqual([
      "achievements",
      "schools",
      "users",
    ]);
  });

  it("emits required database lifecycle logs", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { deps } = createMockDatabaseDeps({
      collections: [{ name: "users", documents: [{ _id: "1" }] }],
    });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-logs", workspaceDir })
    );
    const { events, restore } = collectLogEvents();

    await createDatabaseStage(deps).execute(context);
    restore();

    const requiredEvents = [
      "DATABASE_DISCOVERY_STARTED",
      "DATABASE_DISCOVERY_COMPLETED",
      "DATABASE_COLLECTION_STARTED",
      "DATABASE_COLLECTION_COMPLETED",
      "DATABASE_STAGE_COMPLETED",
    ];

    for (const event of requiredEvents) {
      expect(events.some((line) => line.includes(`[DR.V2] ${event}`))).toBe(true);
    }
  });

  it("logs DATABASE_COLLECTION_FAILED when export throws", async () => {
    const workspaceDir = createWorkspaceDir();
    workspaces.push(workspaceDir);
    const { deps } = createMockDatabaseDeps({
      collections: [{ name: "broken", fail: true }],
    });
    const context = createBackupContext(
      createBackupConfig({ jobId: "job-fail-log", workspaceDir })
    );
    const { events, restore } = collectLogEvents();

    await createDatabaseStage(deps).execute(context);
    restore();

    expect(events.some((line) => line.includes("[DR.V2] DATABASE_COLLECTION_FAILED"))).toBe(true);
  });
});

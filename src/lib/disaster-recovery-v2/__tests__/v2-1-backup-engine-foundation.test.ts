import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it, vi } from "vitest";

import { BackupEngine } from "@/lib/disaster-recovery-v2/engine/backup-engine";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import type { BackupStage, BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";

const createMockStage = (input: {
  id: BackupStageId;
  name: string;
  onExecute?: (context: import("@/lib/disaster-recovery-v2/types/backup-context").BackupContext) => void;
  success?: boolean;
}): BackupStage => ({
  id: input.id,
  name: input.name,
  execute: async (context) => {
    input.onExecute?.(context);
    if (context.artifacts[input.id] === undefined) {
      context.artifacts[input.id] = { completed: true };
    }
    return createStageResult({
      stageId: input.id,
      success: input.success ?? true,
      startedAt: new Date(),
    });
  },
});

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "__tests__") continue;
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith(".ts") && !fullPath.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

describe("DR.BACKUP.V2.1 — backup engine foundation", () => {
  it("constructs an empty engine with no registered stages", () => {
    const engine = new BackupEngine();
    expect(engine.getRegisteredStageIds()).toEqual([]);
  });

  it("registers stages in insertion order", () => {
    const engine = new BackupEngine();
    engine
      .registerStage(createMockStage({ id: "database", name: "Database Export" }))
      .registerStage(createMockStage({ id: "storage-inventory", name: "Storage Inventory" }))
      .registerStage(createMockStage({ id: "asset-download", name: "Asset Download" }));

    expect(engine.getRegisteredStageIds()).toEqual([
      "database",
      "storage-inventory",
      "asset-download",
    ]);
  });

  it("rejects duplicate stage registration", () => {
    const engine = new BackupEngine();
    engine.registerStage(createMockStage({ id: "database", name: "Database Export" }));
    expect(() =>
      engine.registerStage(createMockStage({ id: "database", name: "Duplicate Database" }))
    ).toThrow(/BACKUP_STAGE_ALREADY_REGISTERED:database/);
  });

  it("executes stages sequentially and propagates context artifacts", async () => {
    const executionOrder: BackupStageId[] = [];
    const engine = new BackupEngine();
    engine
      .registerStage(
        createMockStage({
          id: "database",
          name: "Database Export",
          onExecute: (context) => {
            executionOrder.push("database");
            context.artifacts.database = { collections: 3 };
          },
        })
      )
      .registerStage(
        createMockStage({
          id: "storage-inventory",
          name: "Storage Inventory",
          onExecute: (context) => {
            executionOrder.push("storage-inventory");
            expect(context.artifacts.database).toEqual({ collections: 3 });
          },
        })
      )
      .registerStage(
        createMockStage({
          id: "asset-download",
          name: "Asset Download",
          onExecute: (context) => {
            executionOrder.push("asset-download");
            expect(context.stageResults).toHaveLength(2);
          },
        })
      );

    const config = createBackupConfig({
      jobId: "job-v2-1",
      workspaceDir: "/tmp/dr-v2-workspace",
    });

    const result = await engine.run(config);

    expect(executionOrder).toEqual(["database", "storage-inventory", "asset-download"]);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe("job-v2-1");
    expect(result.stageResults).toHaveLength(3);
    expect(result.stageResults.every((stage) => stage.success)).toBe(true);
  });

  it("stops after the first failed stage by default", async () => {
    const executionOrder: BackupStageId[] = [];
    const engine = new BackupEngine();
    engine
      .registerStage(
        createMockStage({
          id: "database",
          name: "Database Export",
          onExecute: () => {
            executionOrder.push("database");
          },
        })
      )
      .registerStage(
        createMockStage({
          id: "storage-inventory",
          name: "Storage Inventory",
          success: false,
          onExecute: () => {
            executionOrder.push("storage-inventory");
          },
        })
      )
      .registerStage(
        createMockStage({
          id: "asset-download",
          name: "Asset Download",
          onExecute: () => {
            executionOrder.push("asset-download");
          },
        })
      );

    const result = await engine.run(
      createBackupConfig({ jobId: "job-fail", workspaceDir: "/tmp/dr-v2" })
    );

    expect(executionOrder).toEqual(["database", "storage-inventory"]);
    expect(result.success).toBe(false);
    expect(result.stageResults).toHaveLength(2);
  });

  it("emits deterministic lifecycle logs", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const engine = new BackupEngine();
    engine.registerStage(createMockStage({ id: "database", name: "Database Export" }));

    await engine.run(createBackupConfig({ jobId: "job-logs", workspaceDir: "/tmp/dr-v2" }));

    const messages = infoSpy.mock.calls.map(([message]) => String(message));
    expect(messages.some((line) => line.includes("[DR.V2] BACKUP_STARTED"))).toBe(true);
    expect(messages.some((line) => line.includes("[DR.V2] DATABASE_STAGE_STARTED"))).toBe(true);
    expect(messages.some((line) => line.includes("[DR.V2] DATABASE_STAGE_COMPLETED"))).toBe(true);
    expect(messages.some((line) => line.includes("[DR.V2] BACKUP_COMPLETED"))).toBe(true);

    infoSpy.mockRestore();
  });

  it("does not import from legacy disaster-recovery modules", () => {
    const root = join(process.cwd(), "src/lib/disaster-recovery-v2");
    const files = collectSourceFiles(root);
    const legacyImportPattern = /from\s+["']@\/lib\/disaster-recovery(?:\/|["'])/;

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(root, file)).not.toMatch(legacyImportPattern);
    }
  });
});

import { createReadStream } from "fs";
import { access } from "fs/promises";
import { join } from "path";

import { uploadR2ObjectStream } from "@/lib/disaster-recovery-v2/object-storage/r2-client";
import {
  parseR2Manifest,
  type R2Manifest,
  type R2ManifestEntry,
} from "@/lib/disaster-recovery-v2/object-storage/r2-manifest";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type R2RestoreDependencies = {
  extractedRootDir: string;
  jobId: string;
  putObject?: typeof uploadR2ObjectStream;
  pathExists?: (filePath: string) => Promise<boolean>;
};

export type R2RestoreEntryResult = {
  key: string;
  relativePath: string;
  status: "restored" | "skipped" | "failed";
  errorMessage?: string;
};

export type R2RestoreResult = {
  skipped: boolean;
  restored: number;
  failed: number;
  skippedCount: number;
  entries: R2RestoreEntryResult[];
};

const defaultPathExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const restoreSingleR2Object = async (
  entry: R2ManifestEntry,
  deps: R2RestoreDependencies
): Promise<R2RestoreEntryResult> => {
  const pathExists = deps.pathExists ?? defaultPathExists;
  const putObject = deps.putObject ?? uploadR2ObjectStream;
  const absolutePath = join(deps.extractedRootDir, entry.relativePath);

  if (!(await pathExists(absolutePath))) {
    return {
      key: entry.key,
      relativePath: entry.relativePath,
      status: "skipped",
      errorMessage: "R2_ASSET_FILE_MISSING",
    };
  }

  try {
    await putObject({
      key: entry.key,
      body: createReadStream(absolutePath),
      contentType: entry.mimeType || "application/octet-stream",
    });

    logDrV2("R2_OBJECT_RESTORED", {
      jobId: deps.jobId,
      key: entry.key,
      relativePath: entry.relativePath,
    });

    return {
      key: entry.key,
      relativePath: entry.relativePath,
      status: "restored",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2_RESTORE_FAILED";
    logDrV2("R2_OBJECT_RESTORE_FAILED", {
      jobId: deps.jobId,
      key: entry.key,
      relativePath: entry.relativePath,
      message,
    });

    return {
      key: entry.key,
      relativePath: entry.relativePath,
      status: "failed",
      errorMessage: message,
    };
  }
};

export const restoreR2ObjectsFromManifest = async (
  manifest: R2Manifest,
  deps: R2RestoreDependencies
): Promise<R2RestoreResult> => {
  const entries: R2RestoreEntryResult[] = [];
  let restored = 0;
  let failed = 0;
  let skippedCount = 0;

  for (const object of manifest.objects) {
    if (object.status && object.status !== "exported") {
      skippedCount += 1;
      entries.push({
        key: object.key,
        relativePath: object.relativePath,
        status: "skipped",
        errorMessage: "R2_OBJECT_NOT_EXPORTED",
      });
      continue;
    }

    const result = await restoreSingleR2Object(object, deps);
    entries.push(result);

    if (result.status === "restored") restored += 1;
    else if (result.status === "failed") failed += 1;
    else skippedCount += 1;
  }

  return {
    skipped: false,
    restored,
    failed,
    skippedCount,
    entries,
  };
};

export const restoreR2ObjectsFromExtractedPackage = async (
  deps: R2RestoreDependencies
): Promise<R2RestoreResult> => {
  const manifestPath = join(deps.extractedRootDir, "metadata", "r2-manifest.json");
  const pathExists = deps.pathExists ?? defaultPathExists;

  if (!(await pathExists(manifestPath))) {
    return {
      skipped: true,
      restored: 0,
      failed: 0,
      skippedCount: 0,
      entries: [],
    };
  }

  const { readFile } = await import("fs/promises");
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  const manifest = parseR2Manifest(raw);
  if (!manifest) {
    throw new Error("R2_MANIFEST_INVALID");
  }

  return restoreR2ObjectsFromManifest(manifest, deps);
};

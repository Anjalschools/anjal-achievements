import { join } from "path";

import type { DiscoveredR2Object } from "@/lib/disaster-recovery-v2/object-storage/r2-discovery";

export const R2_MANIFEST_VERSION = 1 as const;
export const R2_MANIFEST_FILE_NAME = "r2-manifest.json" as const;
export const R2_MANIFEST_ZIP_PATH = `metadata/${R2_MANIFEST_FILE_NAME}` as const;

export type R2ManifestEntry = {
  key: string;
  bucket: string;
  mimeType: string;
  size?: number;
  sha256?: string;
  collection: string;
  documentId: string;
  exportedAt?: string;
  relativePath: string;
  status?: "exported" | "failed" | "pending";
  errorMessage?: string;
};

export type R2Manifest = {
  version: typeof R2_MANIFEST_VERSION;
  generatedAt: string;
  objectCount: number;
  totalBytes: number;
  verified: boolean;
  objects: R2ManifestEntry[];
};

export const resolveR2AssetRelativePath = (key: string): string => {
  const normalized = key.replace(/^\/+/, "").split("/").filter(Boolean).join("/");
  return `assets/r2/${normalized}`;
};

export const resolveR2ManifestWorkspacePath = (workspaceDir: string): string =>
  join(workspaceDir, "metadata", R2_MANIFEST_FILE_NAME);

export const buildR2Manifest = (objects: DiscoveredR2Object[]): R2Manifest => ({
  version: R2_MANIFEST_VERSION,
  generatedAt: new Date().toISOString(),
  objectCount: objects.length,
  totalBytes: objects.reduce((sum, object) => sum + (object.size ?? 0), 0),
  verified: false,
  objects: objects.map((object) => ({
    key: object.key,
    bucket: object.bucket,
    mimeType: object.mimeType,
    size: object.size,
    sha256: object.sha256,
    collection: object.collection,
    documentId: object.documentId,
    relativePath: resolveR2AssetRelativePath(object.key),
    status: "pending",
  })),
});

export const serializeR2Manifest = (manifest: R2Manifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

export const parseR2Manifest = (raw: unknown): R2Manifest | null => {
  if (!raw || typeof raw !== "object") return null;
  const manifest = raw as Partial<R2Manifest>;
  if (manifest.version !== R2_MANIFEST_VERSION || !Array.isArray(manifest.objects)) {
    return null;
  }
  return manifest as R2Manifest;
};

export const summarizeR2ManifestForPackage = (
  manifest: R2Manifest | null | undefined
): { providers: string[]; objects: number; bytes: number } | undefined => {
  if (!manifest) return undefined;

  const exportedObjects = manifest.objects.filter((entry) => entry.status === "exported");
  if (exportedObjects.length === 0) return undefined;

  const bytes = exportedObjects.reduce((sum, entry) => sum + (entry.size ?? 0), 0);

  return {
    providers: ["cloudinary", "r2"],
    objects: exportedObjects.length,
    bytes,
  };
};

import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import { PACKAGE_MANIFEST_VERSION } from "@/lib/disaster-recovery-v2/package/package-manifest-types";

export type RestoreZipReader = {
  readManifest: (zipPath: string) => Promise<PackageManifest>;
};

export type RestorePackageValidationDependencies = {
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256: (filePath: string) => Promise<string>;
  readZipManifest: RestoreZipReader;
};

export const validateRestorePackage = async (input: {
  backupZipPath: string;
  deps: RestorePackageValidationDependencies;
  authoritativeManifestPath?: string;
  readAuthoritativeManifest?: (manifestPath: string) => Promise<PackageManifest | null>;
}): Promise<{ manifest: PackageManifest; sha256: string; sizeBytes: number }> => {
  const fileStat = await input.deps.statFile(input.backupZipPath);
  if (fileStat.size <= 0) {
    throw new Error("RESTORE_PACKAGE_EMPTY");
  }

  const zipManifest = await input.deps.readZipManifest.readManifest(input.backupZipPath);
  if (zipManifest.version !== PACKAGE_MANIFEST_VERSION) {
    throw new Error(`RESTORE_PACKAGE_VERSION_MISMATCH:${zipManifest.version}`);
  }

  const sha256 = await input.deps.computeSha256(input.backupZipPath);
  const authoritativeManifest =
    input.authoritativeManifestPath && input.readAuthoritativeManifest
      ? await input.readAuthoritativeManifest(input.authoritativeManifestPath)
      : null;

  if (
    authoritativeManifest &&
    authoritativeManifest.version !== PACKAGE_MANIFEST_VERSION
  ) {
    throw new Error(`RESTORE_PACKAGE_VERSION_MISMATCH:${authoritativeManifest.version}`);
  }

  const manifest = authoritativeManifest ?? zipManifest;
  const expectedSha256 = manifest.package.sha256.trim();
  const expectedSize = manifest.package.size;

  if (expectedSha256 && sha256 !== expectedSha256) {
    throw new Error("RESTORE_PACKAGE_CHECKSUM_MISMATCH");
  }

  if (expectedSize > 0 && fileStat.size !== expectedSize) {
    throw new Error("RESTORE_PACKAGE_SIZE_MISMATCH");
  }

  return {
    manifest,
    sha256,
    sizeBytes: fileStat.size,
  };
};

import { join } from "path";

export type PackageZipEntry = {
  section: "metadata" | "database" | "assets";
  zipPath: string;
  sourcePath: string;
};

export type PackageZipEntryCollector = {
  pathExists: (filePath: string) => Promise<boolean>;
  listDirectory: (directoryPath: string) => Promise<string[]>;
  statFile: (filePath: string) => Promise<{ isFile: boolean; isDirectory: boolean }>;
};

const compareZipEntries = (left: PackageZipEntry, right: PackageZipEntry): number => {
  const sectionOrder = { metadata: 0, database: 1, assets: 2 } as const;
  const sectionDelta = sectionOrder[left.section] - sectionOrder[right.section];
  if (sectionDelta !== 0) return sectionDelta;
  return left.zipPath.localeCompare(right.zipPath);
};

const collectFilesRecursively = async (
  input: {
    collector: PackageZipEntryCollector;
    sourceRoot: string;
    zipPrefix: string;
    section: PackageZipEntry["section"];
  },
  entries: PackageZipEntry[]
): Promise<void> => {
  if (!(await input.collector.pathExists(input.sourceRoot))) {
    return;
  }

  const stat = await input.collector.statFile(input.sourceRoot);
  if (stat.isFile) {
    entries.push({
      section: input.section,
      zipPath: input.zipPrefix,
      sourcePath: input.sourceRoot,
    });
    return;
  }

  if (!stat.isDirectory) {
    return;
  }

  const children = (await input.collector.listDirectory(input.sourceRoot)).sort((left, right) =>
    left.localeCompare(right)
  );

  for (const childName of children) {
    if (childName.endsWith(".tmp")) continue;

    const childSourcePath = join(input.sourceRoot, childName);
    const childZipPath = `${input.zipPrefix}/${childName}`.replace(/\/+/g, "/");

    await collectFilesRecursively(
      {
        collector: input.collector,
        sourceRoot: childSourcePath,
        zipPrefix: childZipPath,
        section: input.section,
      },
      entries
    );
  }
};

export const collectPackageZipEntries = async (input: {
  workspaceDir: string;
  collector: PackageZipEntryCollector;
  resolvePaths: {
    databaseManifestPath: string;
    storageManifestPath: string;
    assetDownloadReportPath: string;
    missingAssetsPath: string;
    databaseCollectionsDir: string;
    assetsRootDir: string;
    r2ManifestPath: string;
    packageManifestPath: string;
    embeddedPackageManifestPath?: string;
  };
  includePackageManifest?: boolean;
}): Promise<PackageZipEntry[]> => {
  const entries: PackageZipEntry[] = [];
  const { resolvePaths } = input;

  const metadataCopies: Array<{ sourcePath: string; zipFileName: string; optional?: boolean }> = [
    { sourcePath: resolvePaths.databaseManifestPath, zipFileName: "database-manifest.json" },
    { sourcePath: resolvePaths.storageManifestPath, zipFileName: "storage-manifest.json" },
    { sourcePath: resolvePaths.assetDownloadReportPath, zipFileName: "asset-download-report.json", optional: true },
    { sourcePath: resolvePaths.missingAssetsPath, zipFileName: "missing-assets.json", optional: true },
    { sourcePath: resolvePaths.r2ManifestPath, zipFileName: "r2-manifest.json", optional: true },
  ];

  for (const copy of metadataCopies) {
    if (!(await input.collector.pathExists(copy.sourcePath))) {
      if (!copy.optional) continue;
      continue;
    }

    entries.push({
      section: "metadata",
      zipPath: `metadata/${copy.zipFileName}`,
      sourcePath: copy.sourcePath,
    });
  }

  if (input.includePackageManifest) {
    const manifestSourcePath =
      input.resolvePaths.embeddedPackageManifestPath ?? input.resolvePaths.packageManifestPath;
    if (await input.collector.pathExists(manifestSourcePath)) {
      entries.push({
        section: "metadata",
        zipPath: "metadata/manifest.json",
        sourcePath: manifestSourcePath,
      });
    }
  }

  await collectFilesRecursively(
    {
      collector: input.collector,
      sourceRoot: resolvePaths.databaseCollectionsDir,
      zipPrefix: "database/collections",
      section: "database",
    },
    entries
  );

  await collectFilesRecursively(
    {
      collector: input.collector,
      sourceRoot: resolvePaths.assetsRootDir,
      zipPrefix: "assets",
      section: "assets",
    },
    entries
  );

  return entries.sort(compareZipEntries);
};

export const sortPackageZipEntries = (entries: PackageZipEntry[]): PackageZipEntry[] =>
  [...entries].sort(compareZipEntries);

export const listUniqueZipDirectories = (entries: PackageZipEntry[]): string[] => {
  const directories = new Set<string>();

  for (const entry of entries) {
    const parts = entry.zipPath.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }

  return [...directories].sort((left, right) => left.localeCompare(right));
};

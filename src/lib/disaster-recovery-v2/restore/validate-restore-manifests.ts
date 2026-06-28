import {
  REQUIRED_RESTORE_MANIFESTS,
  resolveExtractedMetadataPath,
} from "@/lib/disaster-recovery-v2/restore/restore-paths";

export const validateRestoreManifests = async (input: {
  extractedRootDir: string;
  pathExists: (filePath: string) => Promise<boolean>;
}): Promise<void> => {
  const missingManifests: string[] = [];

  for (const manifestName of REQUIRED_RESTORE_MANIFESTS) {
    const manifestPath = resolveExtractedMetadataPath(input.extractedRootDir, manifestName);
    if (!(await input.pathExists(manifestPath))) {
      missingManifests.push(manifestName);
    }
  }

  if (missingManifests.length > 0) {
    throw new Error(`RESTORE_MANIFESTS_MISSING:${missingManifests.join(",")}`);
  }
};

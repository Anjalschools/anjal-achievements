import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";

export type BackupZipVerificationResult = {
  sizeBytes: number;
  sha256: string;
  entryCount: number;
};

export type BackupZipReader = {
  listFileEntries: (zipPath: string) => Promise<string[]>;
};

export const createUnzipperBackupZipReader = (): BackupZipReader => ({
  listFileEntries: async (zipPath: string) => {
    const unzipper = (await import("unzipper")).default;
    const directory = await unzipper.Open.file(zipPath);
    return directory.files
      .filter((entry) => entry.type !== "Directory")
      .map((entry) => entry.path)
      .sort((left, right) => left.localeCompare(right));
  },
});

export const verifyBackupZip = async (input: {
  zipPath: string;
  expectedEntryCount: number;
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256?: (filePath: string) => Promise<string>;
  readZipEntries: BackupZipReader;
}): Promise<BackupZipVerificationResult> => {
  const stat = await input.statFile(input.zipPath);
  if (stat.size <= 0) {
    throw new Error("ZIP_EMPTY");
  }

  const zipEntries = await input.readZipEntries.listFileEntries(input.zipPath);
  if (zipEntries.length !== input.expectedEntryCount) {
    throw new Error(
      `ZIP_ENTRY_COUNT_MISMATCH:expected=${input.expectedEntryCount},actual=${zipEntries.length}`
    );
  }

  const computeSha256 = input.computeSha256 ?? computeFileSha256;
  const sha256 = await computeSha256(input.zipPath);

  return {
    sizeBytes: stat.size,
    sha256,
    entryCount: zipEntries.length,
  };
};

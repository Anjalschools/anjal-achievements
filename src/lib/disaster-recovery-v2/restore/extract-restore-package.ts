import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

export type RestoreZipExtractor = {
  extract: (input: { zipPath: string; destinationDir: string }) => Promise<void>;
};

export const createUnzipperRestoreZipExtractor = (): RestoreZipExtractor => ({
  extract: async ({ zipPath, destinationDir }) => {
    const unzipper = (await import("unzipper")).default;
    const directory = await unzipper.Open.file(zipPath);

    for (const entry of directory.files) {
      if (entry.type === "Directory") continue;

      const destinationPath = join(destinationDir, entry.path);
      await mkdir(dirname(destinationPath), { recursive: true });
      const content = await entry.buffer();
      await writeFile(destinationPath, content);
    }
  },
});

export const extractRestorePackage = async (input: {
  backupZipPath: string;
  destinationDir: string;
  ensureDirectory: (directoryPath: string) => Promise<void>;
  extractor: RestoreZipExtractor;
}): Promise<void> => {
  await input.ensureDirectory(input.destinationDir);
  await input.extractor.extract({
    zipPath: input.backupZipPath,
    destinationDir: input.destinationDir,
  });
};

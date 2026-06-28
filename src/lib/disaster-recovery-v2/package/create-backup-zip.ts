import { createWriteStream } from "fs";
import { finished } from "stream/promises";
import { ZipArchive } from "archiver";

import type { PackageZipEntry } from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import { listUniqueZipDirectories } from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type ZipArchiveWriter = {
  appendFile: (sourcePath: string, zipPath: string) => void;
  finalize: () => Promise<void>;
};

export type ZipArchiveWriterFactory = (outputPath: string) => ZipArchiveWriter;

export const createArchiverZipWriterFactory = (): ZipArchiveWriterFactory => {
  return (outputPath: string): ZipArchiveWriter => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(outputPath);
    archive.pipe(output);

    return {
      appendFile: (sourcePath, zipPath) => {
        archive.file(sourcePath, { name: zipPath });
      },
      finalize: async () => {
        archive.finalize();
        await finished(output);
      },
    };
  };
};

export const createBackupZip = async (input: {
  outputPath: string;
  entries: PackageZipEntry[];
  jobId: string;
  createZipWriter: ZipArchiveWriterFactory;
}): Promise<void> => {
  const writer = input.createZipWriter(input.outputPath);
  const directories = listUniqueZipDirectories(input.entries);

  for (const directoryPath of directories) {
    logDrV2("PACKAGE_ADD_DIRECTORY", {
      jobId: input.jobId,
      directoryPath,
    });
  }

  for (const entry of input.entries) {
    logDrV2("PACKAGE_ADD_FILE", {
      jobId: input.jobId,
      zipPath: entry.zipPath,
      sourcePath: entry.sourcePath,
    });
    writer.appendFile(entry.sourcePath, entry.zipPath);
  }

  await writer.finalize();
};

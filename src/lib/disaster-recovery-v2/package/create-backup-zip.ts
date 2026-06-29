import { createWriteStream, statSync } from "fs";
import { finished } from "stream/promises";
import { ZipArchive } from "archiver";

import type { PackageZipEntry } from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import { listUniqueZipDirectories } from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import {
  logMemorySnapshot,
  logV2StreamRegistryCounts,
} from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";
import { trackV2Stream } from "@/lib/disaster-recovery-v2/diagnostics/v2-stream-registry";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type ZipArchiveWriter = {
  appendFile: (sourcePath: string, zipPath: string) => void;
  finalize: () => Promise<void>;
};

export type ZipArchiveWriterFactory = (outputPath: string) => ZipArchiveWriter;

export const createArchiverZipWriterFactory = (): ZipArchiveWriterFactory => {
  return (outputPath: string): ZipArchiveWriter => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = trackV2Stream(createWriteStream(outputPath), {
      kind: "write",
      label: `zip-output:${outputPath}`,
    });
    archive.pipe(output);

    logDrV2("ZIP_STREAM_CREATED", { outputPath });
    logMemorySnapshot("ZIP_STREAM_CREATED", { outputPath });

    return {
      appendFile: (sourcePath, zipPath) => {
        archive.file(sourcePath, { name: zipPath });
      },
      finalize: async () => {
        logDrV2("ZIP_STREAM_FINALIZED", { outputPath });
        logMemorySnapshot("ZIP_STREAM_FINALIZED", { outputPath, jobId: undefined });
        archive.finalize();
        await finished(output);
        logDrV2("ZIP_STREAM_CLOSED", { outputPath });
        logMemorySnapshot("ZIP_STREAM_CLOSED", { outputPath });
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

  let filesAdded = 0;
  let bytesWritten = 0;

  for (const entry of input.entries) {
    logDrV2("PACKAGE_ADD_FILE", {
      jobId: input.jobId,
      zipPath: entry.zipPath,
      sourcePath: entry.sourcePath,
    });
    writer.appendFile(entry.sourcePath, entry.zipPath);
    filesAdded += 1;
    try {
      bytesWritten += statSync(entry.sourcePath).size;
    } catch {
      // Diagnostic-only; skip unreadable entries.
    }

    if (filesAdded % 100 === 0 || filesAdded === input.entries.length) {
      logMemorySnapshot("PACKAGE_BUILD_PROGRESS", {
        jobId: input.jobId,
        filesAdded,
        bytesWritten,
        totalFiles: input.entries.length,
      });
      logV2StreamRegistryCounts("PACKAGE_BUILD_PROGRESS", {
        jobId: input.jobId,
        filesAdded,
      });
    }
  }

  await writer.finalize();

  logMemorySnapshot("ZIP_BYTES_WRITTEN", {
    jobId: input.jobId,
    outputPath: input.outputPath,
    filesAdded,
    bytesWritten,
  });
};

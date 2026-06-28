import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";

export type VerifiedDownloadFile = {
  sizeBytes: number;
  sha256: string;
};

export const verifyDownloadedAssetFile = async (input: {
  filePath: string;
  expectedBytes?: number;
  contentLength?: number;
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256?: (filePath: string) => Promise<string>;
}): Promise<VerifiedDownloadFile> => {
  const stat = await input.statFile(input.filePath);

  if (stat.size <= 0) {
    throw new Error("FILE_EMPTY");
  }

  if (input.contentLength !== undefined && stat.size !== input.contentLength) {
    throw new Error("CONTENT_LENGTH_MISMATCH");
  }

  if (input.expectedBytes !== undefined && input.expectedBytes > 0 && stat.size !== input.expectedBytes) {
    throw new Error("EXPECTED_SIZE_MISMATCH");
  }

  const computeSha256 = input.computeSha256 ?? computeFileSha256;
  const sha256 = await computeSha256(input.filePath);

  return {
    sizeBytes: stat.size,
    sha256,
  };
};

import { Readable } from "stream";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DrOperationTimeoutError } from "@/lib/disaster-recovery/dr-async-timeout";
import { HASHING_PIPELINE_TIMEOUT_CODE } from "@/lib/disaster-recovery/dr-cloudinary-export-policy";
import {
  handleCloudinaryHashingPipelineTimeoutSkip,
  isCloudinaryHashingPipelineTimeout,
} from "@/lib/disaster-recovery/dr-cloudinary-hashing-timeout-skip";
import {
  getMissingAssetRecords,
  resetMissingAssetRegistry,
} from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

const buildEntry = (): StorageManifestEntry => ({
  id: "entry-1",
  provider: "cloudinary",
  storageKey: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
  archivePath: "objects/cloudinary/sample.jpg",
  sourceCollection: "achievements",
  sourceDocumentId: "doc-1",
  sourceField: "image",
  status: "pending",
});

describe("phase DR.ZIP.20 — cloudinary hashing pipeline timeout skip", () => {
  it("detects hashing pipeline timeout only for cloudinary", () => {
    const error = new DrOperationTimeoutError("hashingPipeline", 180000, "objects/cloudinary/sample.jpg");
    expect(isCloudinaryHashingPipelineTimeout(error, "cloudinary")).toBe(true);
    expect(isCloudinaryHashingPipelineTimeout(error, "r2")).toBe(false);
    expect(
      isCloudinaryHashingPipelineTimeout(
        new Error("DR_TIMEOUT:hashingPipeline:objects/cloudinary/sample.jpg:180000ms"),
        "cloudinary"
      )
    ).toBe(true);
    expect(
      isCloudinaryHashingPipelineTimeout(
        new Error("DR_TIMEOUT:streamHashCompleted:objects/cloudinary/sample.jpg:180000ms"),
        "cloudinary"
      )
    ).toBe(false);
  });

  it("records missing asset and returns missing manifest entry", () => {
    resetMissingAssetRegistry();
    const stream = new Readable({ read() {} });
    stream.on("error", () => undefined);
    const registry = {
      markProducerError: vi.fn(),
      markProducerCompleted: vi.fn(),
    };

    const missingEntry = handleCloudinaryHashingPipelineTimeoutSkip({
      entry: buildEntry(),
      error: new DrOperationTimeoutError("hashingPipeline", 180000, "objects/cloudinary/sample.jpg"),
      stream,
      streamRegistry: registry as never,
    });

    expect(missingEntry.status).toBe("missing");
    expect(missingEntry.errorMessage).toBe(HASHING_PIPELINE_TIMEOUT_CODE);
    expect(registry.markProducerError).toHaveBeenCalledTimes(1);
    expect(registry.markProducerCompleted).toHaveBeenCalledTimes(1);
    expect(getMissingAssetRecords()).toHaveLength(1);
    expect(getMissingAssetRecords()[0]?.stage).toBe("hashingPipeline");
    expect(getMissingAssetRecords()[0]?.errorCode).toBe(HASHING_PIPELINE_TIMEOUT_CODE);
  });
});

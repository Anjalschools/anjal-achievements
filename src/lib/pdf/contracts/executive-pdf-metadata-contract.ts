import type { ExecutivePdfMetadata } from "@/lib/pdf/executive-pdf-metadata";

export type ExecutivePdfMetadataContract = {
  metadata?: ExecutivePdfMetadata;
  requireGeneratedAt?: boolean;
};

export type ExecutivePdfMetadataValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export const validateExecutivePdfMetadataContract = (
  contract: ExecutivePdfMetadataContract
): ExecutivePdfMetadataValidationResult => {
  if (!contract.metadata) return { ok: true };
  if (contract.requireGeneratedAt && !contract.metadata.generatedAtIso?.trim()) {
    return { ok: false, code: "MISSING_GENERATED_AT", message: "generatedAtIso is required" };
  }
  return { ok: true };
};

export type PortfolioExceptionClass =
  | "ValidationError"
  | "MissingField"
  | "InvalidMimeType"
  | "InvalidEvidenceCategory"
  | "ReferenceGenerationError"
  | "StreamingPreparationError"
  | "UnknownError";

export const classifyPortfolioException = (error: unknown): PortfolioExceptionClass => {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message.toLowerCase();
  const name = err.name.toLowerCase();

  if (name.includes("validation") || message.includes("validation")) {
    return "ValidationError";
  }
  if (
    message.includes("invalid_achievement_id") ||
    message.includes("invalid_attachment_index") ||
    message.includes("invalid id")
  ) {
    return "ValidationError";
  }
  if (
    message.includes("portfolio_evidence_secret") ||
    message.includes("signed ref") ||
    message.includes("reference")
  ) {
    return "ReferenceGenerationError";
  }
  if (message.includes("mime") || message.includes("mimetype")) {
    return "InvalidMimeType";
  }
  if (message.includes("evidence_category") || message.includes("invalid category")) {
    return "InvalidEvidenceCategory";
  }
  if (
    message.includes("stream") ||
    message.includes("r2_") ||
    message.includes("download_failed")
  ) {
    return "StreamingPreparationError";
  }
  if (
    message.includes("missing") ||
    message.includes("required") ||
    message.includes("not found") ||
    message.includes("undefined")
  ) {
    return "MissingField";
  }

  return "UnknownError";
};

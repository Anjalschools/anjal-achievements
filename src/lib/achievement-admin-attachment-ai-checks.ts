import type {
  AdminAttachmentAiChecks,
  AdminAttachmentMatchValue,
} from "@/types/admin-attachment-ai-review";

export const deriveOverallFromChecks = (checks: AdminAttachmentAiChecks): AdminAttachmentMatchValue => {
  const vals = Object.values(checks).filter(
    (x): x is AdminAttachmentMatchValue => x === "match" || x === "mismatch" || x === "unclear"
  );
  if (vals.some((x) => x === "mismatch")) return "mismatch";
  if (vals.length > 0 && vals.every((x) => x === "match")) return "match";
  return "unclear";
};

export const TRAINING_COMPLETION_STATUSES = [
  "pending",
  "submitted",
  "under_review",
  "approved",
  "rejected",
] as const;
export type TrainingCompletionStatus = (typeof TRAINING_COMPLETION_STATUSES)[number];

export const TRAINING_ATTACHMENT_TYPES = ["pdf", "image", "document"] as const;
export type TrainingAttachmentType = (typeof TRAINING_ATTACHMENT_TYPES)[number];

export const TRAINING_REPORT_SUPERVISOR_ACTIONS = [
  "approve",
  "reject",
  "request_changes",
] as const;
export type TrainingReportSupervisorAction = (typeof TRAINING_REPORT_SUPERVISOR_ACTIONS)[number];

export const TRAINING_COMPLETION_STATUS_LABELS: Record<
  TrainingCompletionStatus,
  { ar: string; en: string }
> = {
  pending: { ar: "مسودة", en: "Draft" },
  submitted: { ar: "مُرسل", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  approved: { ar: "معتمد", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

export const isValidRating = (value: unknown): value is number => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5;
};

export const isAllowedTrainingVideoUrl = (raw: string): boolean => {
  const url = String(raw || "").trim().toLowerCase();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("vimeo.com") ||
    url.includes("drive.google.com") ||
    url.includes("docs.google.com") ||
    url.includes("onedrive.live.com") ||
    url.includes("1drv.ms") ||
    url.includes("sharepoint.com")
  );
};

export const inferTrainingAttachmentType = (
  fileName: string,
  mimeType?: string
): TrainingAttachmentType => {
  const name = String(fileName || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  if (name.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) return "image";
  return "document";
};

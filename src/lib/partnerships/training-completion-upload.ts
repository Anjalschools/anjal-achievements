import type { TrainingAttachmentType } from "@/lib/partnerships/training-completion-constants";
import { inferTrainingAttachmentType } from "@/lib/partnerships/training-completion-constants";

export type UploadedTrainingAttachment = {
  type: TrainingAttachmentType;
  fileName: string;
  storageKey: string;
  mimeType?: string;
  storageProvider?: "r2" | "cloudinary";
};

const uploadImage = async (file: File): Promise<UploadedTrainingAttachment> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/image", { method: "POST", body: formData, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Image upload failed");
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url) throw new Error("Invalid image upload response");
  return {
    type: "image",
    fileName: typeof data.originalFilename === "string" ? data.originalFilename : file.name,
    storageKey: url,
    mimeType: file.type || "image/jpeg",
  };
};

const uploadAttachment = async (file: File): Promise<UploadedTrainingAttachment> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/attachment", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Attachment upload failed");
  const key = typeof data.key === "string" ? data.key.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  const storageKey = url || key;
  if (!storageKey) throw new Error("Invalid attachment upload response");
  const fileName =
    typeof data.fileName === "string" && data.fileName.trim() ? data.fileName : file.name;
  const mimeType =
    typeof data.mimeType === "string" && data.mimeType.trim() ? data.mimeType : file.type;
  return {
    type: inferTrainingAttachmentType(fileName, mimeType),
    fileName,
    storageKey,
    mimeType,
    storageProvider: "r2",
  };
};

export const uploadParentConsentEvidenceFile = async (file: File): Promise<UploadedTrainingAttachment> => {
  return uploadAttachment(file);
};

export const uploadTrainingReportFile = async (file: File): Promise<UploadedTrainingAttachment> => {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return uploadImage(file);
  return uploadAttachment(file);
};

/** Institution stamped report — PDF or scan (separate from student attachments). */
export const uploadInstitutionReportFile = async (file: File): Promise<UploadedTrainingAttachment> => {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(name)) return uploadImage(file);
  return uploadAttachment(file);
};

/** Training final evaluation evidence — reuses achievement image upload pipeline. */
export const uploadTrainingEvidenceImage = async (file: File): Promise<UploadedTrainingAttachment> =>
  uploadImage(file);

export {
  attachmentDisplayUrl,
  isAttachmentDisplayUrlResolvable,
  isBareR2AttachmentKey,
  resolveAttachmentDisplayUrl,
  type AttachmentDisplayUrlResult,
} from "@/lib/partnerships/attachment-display-url";

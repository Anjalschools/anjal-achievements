import type { AchievementAttachmentObject } from "@/lib/achievement-attachments";
import { normalizeAttachmentsArray } from "@/lib/achievement-attachments";
import { createPortfolioEvidenceRef } from "@/lib/portfolio/portfolio-evidence-ref";
import type {
  PortfolioEvidenceCategory,
  PortfolioEvidenceKind,
  PublicPortfolioEvidenceItem,
} from "@/lib/portfolio/portfolio-evidence-types";

export const isAttachmentPublicPortfolioVisible = (
  attachment: AchievementAttachmentObject
): boolean =>
  attachment.approved === true && attachment.showInPublicPortfolio === true;

export const inferPortfolioEvidenceKind = (mimeType: string): PortfolioEvidenceKind => {
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "document";
};

export const inferPortfolioEvidenceCategory = (input: {
  mimeType: string;
  name: string;
}): PortfolioEvidenceCategory => {
  const mime = input.mimeType.toLowerCase();
  const name = input.name.toLowerCase();

  if (mime.includes("pdf") || /cert|certificate|شهادة|letter|خطاب/.test(name)) {
    return "certificate";
  }
  if (mime.startsWith("image/")) {
    if (/trophy|medal|photo|صورة|نشاط|activity/.test(name)) return "photo";
    if (/cert|certificate|شهادة/.test(name)) return "certificate";
    return "photo";
  }
  return "document";
};

export const buildPublicPortfolioEvidenceItems = (input: {
  achievementId: string;
  attachmentsRaw: unknown;
}): PublicPortfolioEvidenceItem[] => {
  const attachments = normalizeAttachmentsArray(input.attachmentsRaw);
  const items: PublicPortfolioEvidenceItem[] = [];

  attachments.forEach((attachment, index) => {
    if (!isAttachmentPublicPortfolioVisible(attachment)) return;
    const kind = inferPortfolioEvidenceKind(attachment.mimeType);
    const category =
      attachment.evidenceCategory ?? inferPortfolioEvidenceCategory({
        mimeType: attachment.mimeType,
        name: attachment.name,
      });

    items.push({
      ref: createPortfolioEvidenceRef({ achievementId: input.achievementId, attachmentIndex: index }),
      name: attachment.name,
      kind,
      category,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.size,
    });
  });

  return items;
};

export const resolvePublicAttachmentByIndex = (
  attachmentsRaw: unknown,
  attachmentIndex: number
): AchievementAttachmentObject | null => {
  const attachments = normalizeAttachmentsArray(attachmentsRaw);
  const attachment = attachments[attachmentIndex];
  if (!attachment || !isAttachmentPublicPortfolioVisible(attachment)) return null;
  return attachment;
};

export type PortfolioEvidenceFilter = "all" | PortfolioEvidenceCategory | "pdf";

export const filterPublicPortfolioEvidenceItems = (
  items: PublicPortfolioEvidenceItem[],
  filter: PortfolioEvidenceFilter
): PublicPortfolioEvidenceItem[] => {
  if (filter === "all") return items;
  if (filter === "pdf") return items.filter((item) => item.kind === "pdf");
  return items.filter((item) => item.category === filter);
};

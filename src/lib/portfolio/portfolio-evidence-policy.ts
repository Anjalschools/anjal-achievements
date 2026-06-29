import type { AchievementAttachmentObject } from "@/lib/achievement-attachments";
import { normalizeAttachmentsArray } from "@/lib/achievement-attachments";
import { createPortfolioEvidenceRef } from "@/lib/portfolio/portfolio-evidence-ref";
import {
  logPortfolioFault,
  type PortfolioFaultContext,
} from "@/lib/portfolio/portfolio-fault-diagnostics";
import type {
  PortfolioEvidenceCategory,
  PortfolioEvidenceKind,
  PublicPortfolioEvidenceItem,
} from "@/lib/portfolio/portfolio-evidence-types";

const ACHIEVEMENT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export const isAttachmentPublicPortfolioVisible = (
  attachment: AchievementAttachmentObject
): boolean =>
  attachment.approved === true && attachment.showInPublicPortfolio === true;

export const inferPortfolioEvidenceKind = (mimeType: string): PortfolioEvidenceKind => {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "document";
};

export const inferPortfolioEvidenceCategory = (input: {
  mimeType: string;
  name: string;
}): PortfolioEvidenceCategory => {
  const mime = String(input.mimeType || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();

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

const resolveAttachmentDisplayName = (attachment: AchievementAttachmentObject): string => {
  const name = typeof attachment.name === "string" ? attachment.name.trim() : "";
  if (name) return name.slice(0, 120);
  return "attachment";
};

const resolveAttachmentMimeType = (attachment: AchievementAttachmentObject): string => {
  const mimeType = typeof attachment.mimeType === "string" ? attachment.mimeType.trim() : "";
  return mimeType || "application/octet-stream";
};

export const tryBuildPublicPortfolioEvidenceItem = (input: {
  achievementId: string;
  attachment: AchievementAttachmentObject;
  attachmentIndex: number;
  faultCtx?: PortfolioFaultContext;
  achievementTitle?: string | null;
}): PublicPortfolioEvidenceItem | null => {
  const achievementId = String(input.achievementId || "").trim();
  const attachmentIndex = input.attachmentIndex;
  const attachment = input.attachment;
  const attachmentName = resolveAttachmentDisplayName(attachment);
  const diagnostics = input.faultCtx?.diagnostics;
  const attachmentStartedAt = Date.now();
  const mimeTypeForLog = resolveAttachmentMimeType(attachment);
  const categoryForLog =
    attachment.evidenceCategory === "certificate" ||
    attachment.evidenceCategory === "photo" ||
    attachment.evidenceCategory === "document"
      ? attachment.evidenceCategory
      : null;

  try {
    if (!ACHIEVEMENT_ID_PATTERN.test(achievementId)) return null;
    if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0) return null;
    if (!isAttachmentPublicPortfolioVisible(attachment)) return null;

    diagnostics?.logAttachmentStart({
      achievementId,
      attachmentIndex,
      attachmentName,
      mimeType: mimeTypeForLog,
      evidenceCategory: categoryForLog,
      approved: attachment.approved === true,
      showInPublicPortfolio: attachment.showInPublicPortfolio === true,
    });

    const mimeType = mimeTypeForLog;
    const name = attachmentName;
    const kind = inferPortfolioEvidenceKind(mimeType);
    const category =
      attachment.evidenceCategory === "certificate" ||
      attachment.evidenceCategory === "photo" ||
      attachment.evidenceCategory === "document"
        ? attachment.evidenceCategory
        : inferPortfolioEvidenceCategory({ mimeType, name });

    diagnostics?.startStage("BUILD_SIGNED_REFS");
    const ref = createPortfolioEvidenceRef({ achievementId, attachmentIndex });
    diagnostics?.successStage("BUILD_SIGNED_REFS");

    const sizeBytes =
      typeof attachment.size === "number" && Number.isFinite(attachment.size) && attachment.size >= 0
        ? attachment.size
        : undefined;

    const item = {
      ref,
      name,
      kind,
      category,
      mimeType,
      sizeBytes,
    };

    diagnostics?.logAttachmentSuccess({
      achievementId,
      attachmentIndex,
      durationMs: Date.now() - attachmentStartedAt,
    });

    return item;
  } catch (error) {
    diagnostics?.logAttachmentFailed({
      achievementId,
      attachmentIndex,
      attachmentName,
      error,
    });
    logPortfolioFault(input.faultCtx, "attachment", error, {
      achievementId,
      achievementTitle: input.achievementTitle ?? null,
      attachmentIndex,
      attachmentName,
      attachmentCategory: categoryForLog,
      phase: "evidence_item",
    });
    return null;
  }
};

export const buildPublicPortfolioEvidenceItems = (input: {
  achievementId: string;
  attachmentsRaw: unknown;
  faultCtx?: PortfolioFaultContext;
  achievementTitle?: string | null;
}): PublicPortfolioEvidenceItem[] => {
  const achievementId = String(input.achievementId || "").trim();
  const achievementTitle = input.achievementTitle ?? null;
  const diagnostics = input.faultCtx?.diagnostics;

  try {
    const attachments = normalizeAttachmentsArray(input.attachmentsRaw);
    if (diagnostics) {
      diagnostics.attachmentsLoaded += attachments.length;
    }

    diagnostics?.startStage("BUILD_EVIDENCE");
    const items: PublicPortfolioEvidenceItem[] = [];

    attachments.forEach((attachment, index) => {
      const item = tryBuildPublicPortfolioEvidenceItem({
        achievementId,
        attachment,
        attachmentIndex: index,
        faultCtx: input.faultCtx,
        achievementTitle,
      });
      if (item) items.push(item);
    });

    diagnostics?.successStage("BUILD_EVIDENCE");
    return items;
  } catch (error) {
    diagnostics?.failedStage("BUILD_EVIDENCE", error);
    logPortfolioFault(input.faultCtx, "evidence_gallery", error, {
      achievementId,
      achievementTitle,
      phase: "evidence_batch",
    });
    return [];
  }
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

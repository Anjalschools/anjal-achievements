import type { AchievementAttachmentObject } from "@/lib/achievement-attachments";
import {
  extractAttachmentUrl,
  inferMimeFromUrl,
  normalizeAttachmentsArray,
} from "@/lib/achievement-attachments";
import { createHmac, timingSafeEqual } from "crypto";
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
const COVER_IMAGE_EVIDENCE_NAME = "cover-image";
const REF_SEPARATOR = ".";
const PAYLOAD_SEPARATOR = "|";
const PORTFOLIO_COVER_REF_MARKER = "__portfolio_cover__";

const trimEvidenceUrl = (url: string): string => url.trim();

const resolvePortfolioEvidenceRefSecret = (): string => {
  const secret = process.env.PORTFOLIO_EVIDENCE_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "PORTFOLIO_EVIDENCE_SECRET_UNAVAILABLE: Missing PORTFOLIO_EVIDENCE_SECRET environment variable."
    );
  }
  return secret;
};

const signPortfolioEvidencePayload = (payload: string): string =>
  createHmac("sha256", resolvePortfolioEvidenceRefSecret()).update(payload).digest("base64url");

const createPortfolioCoverEvidenceRef = (achievementId: string): string => {
  const id = String(achievementId || "").trim();
  if (!ACHIEVEMENT_ID_PATTERN.test(id)) {
    throw new Error("INVALID_ACHIEVEMENT_ID");
  }
  const payload = `${id}${PAYLOAD_SEPARATOR}${PORTFOLIO_COVER_REF_MARKER}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}${REF_SEPARATOR}${signPortfolioEvidencePayload(payload)}`;
};

export const parsePortfolioCoverEvidenceRef = (ref: string): { achievementId: string } | null => {
  const trimmed = String(ref || "").trim();
  const dot = trimmed.lastIndexOf(REF_SEPARATOR);
  if (dot <= 0) return null;

  const encoded = trimmed.slice(0, dot);
  const signature = trimmed.slice(dot + 1);
  if (!encoded || !signature) return null;

  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = signPortfolioEvidencePayload(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const [achievementId, marker] = payload.split(PAYLOAD_SEPARATOR);
  if (!achievementId || !ACHIEVEMENT_ID_PATTERN.test(achievementId)) return null;
  if (marker !== PORTFOLIO_COVER_REF_MARKER) return null;

  return { achievementId };
};

const resolveAchievementCoverImageUrl = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) return null;
  return url;
};

const coverImageUrlAlreadyUsed = (
  attachmentsRaw: unknown,
  coverImageUrl: string,
  evidenceUrls: ReadonlySet<string>
): boolean => {
  const cover = trimEvidenceUrl(coverImageUrl);
  if (!cover) return true;
  if (evidenceUrls.has(cover)) return true;

  const attachments = normalizeAttachmentsArray(attachmentsRaw);
  return attachments.some((attachment) => {
    const attachmentUrl = extractAttachmentUrl(attachment);
    return attachmentUrl ? trimEvidenceUrl(attachmentUrl) === cover : false;
  });
};

export const resolveVirtualCoverEvidenceStreamSource = (input: {
  attachmentsRaw: unknown;
  coverImageUrl: unknown;
}): { url: string; mimeType: string; fileName: string } | null => {
  const resolvedCoverUrl = resolveAchievementCoverImageUrl(input.coverImageUrl);
  if (!resolvedCoverUrl) return null;
  if (coverImageUrlAlreadyUsed(input.attachmentsRaw, resolvedCoverUrl, new Set<string>())) {
    return null;
  }

  return {
    url: resolvedCoverUrl,
    mimeType: inferMimeFromUrl(resolvedCoverUrl),
    fileName: COVER_IMAGE_EVIDENCE_NAME,
  };
};

const tryBuildVirtualCoverEvidenceItem = (input: {
  achievementId: string;
  coverImageUrl: string;
  faultCtx?: PortfolioFaultContext;
  achievementTitle?: string | null;
}): PublicPortfolioEvidenceItem | null => {
  const achievementId = String(input.achievementId || "").trim();
  const resolvedCoverUrl = resolveAchievementCoverImageUrl(input.coverImageUrl);
  if (!ACHIEVEMENT_ID_PATTERN.test(achievementId) || !resolvedCoverUrl) return null;

  try {
    const mimeType = inferMimeFromUrl(resolvedCoverUrl);
    const ref = createPortfolioCoverEvidenceRef(achievementId);
    return {
      ref,
      name: COVER_IMAGE_EVIDENCE_NAME,
      kind: inferPortfolioEvidenceKind(mimeType),
      category: "photo",
      mimeType,
    };
  } catch (error) {
    logPortfolioFault(input.faultCtx, "attachment", error, {
      achievementId,
      achievementTitle: input.achievementTitle ?? null,
      attachmentIndex: null,
      attachmentName: COVER_IMAGE_EVIDENCE_NAME,
      attachmentCategory: "photo",
      phase: "virtual_cover_evidence",
    });
    return null;
  }
};

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
  coverImageUrl?: string;
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
    const evidenceUrls = new Set<string>();

    attachments.forEach((attachment, index) => {
      const item = tryBuildPublicPortfolioEvidenceItem({
        achievementId,
        attachment,
        attachmentIndex: index,
        faultCtx: input.faultCtx,
        achievementTitle,
      });
      if (item) {
        items.push(item);
        evidenceUrls.add(trimEvidenceUrl(attachment.url));
      }
    });

    const resolvedCoverUrl = resolveAchievementCoverImageUrl(input.coverImageUrl);
    if (
      resolvedCoverUrl &&
      !coverImageUrlAlreadyUsed(input.attachmentsRaw, resolvedCoverUrl, evidenceUrls)
    ) {
      const coverItem = tryBuildVirtualCoverEvidenceItem({
        achievementId,
        coverImageUrl: resolvedCoverUrl,
        faultCtx: input.faultCtx,
        achievementTitle,
      });
      if (coverItem) items.push(coverItem);
    }

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

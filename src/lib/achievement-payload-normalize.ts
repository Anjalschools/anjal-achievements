import { normalizeAttachmentsArray, type AchievementAttachmentObject } from "@/lib/achievement-attachments";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { QUDRAT_TIER_ALLOWED_VALUES } from "@/constants/achievement-options";
import { normalizeLegacyQudratAchievementName } from "@/lib/achievementNormalize";

export type NormalizedPayload = {
  achievementType: string;
  achievementCategory?: string;
  achievementName: string;
  nameAr?: string;
  nameEn?: string;
  customAchievementName?: string;
  achievementLevel: string;
  participationType: string;
  teamRole?: string;
  resultType: string;
  resultValue?: string;
  medalType?: string;
  rank?: string;
  nominationText?: string;
  specialAwardText?: string;
  recognitionText?: string;
  otherResultText?: string;
  olympiadField?: string;
  mawhibaAnnualSubject?: string;
  giftedDiscoveryScore?: number;
  achievementYear: number;
  achievementDate?: string;
  achievementClassification?: string;
  description?: string;
  image?: string;
  /** Cloudinary public_id when image is hosted on Cloudinary (optional). */
  imagePublicId?: string;
  attachments?: AchievementAttachmentObject[];
  evidenceUrl?: string;
  evidenceFileName?: string;
  evidenceRequiredMode: "provided" | "skipped";
  requiresCommitteeReview: boolean;
  verificationStatus: "unverified" | "pending_committee_review";
  verificationSummary: string;
  evidenceMatchStatus: "unknown";
  evidenceExtractedData: Record<string, unknown> | null;
  featured: boolean;
};

export const normalizeAchievementPayload = (rawBody: Record<string, unknown>): NormalizedPayload => {
  const body = sanitizeMongoShape(rawBody) as Record<string, unknown>;
  const achievementType = String(body.achievementType || "");
  const achievementCategory = String(body.achievementCategory || achievementType || "competition");
  const achievementClassificationRaw = String(body.achievementClassification || "").trim();
  const allowedClass = [
    "academic",
    "technical",
    "cultural",
    "research",
    "volunteer",
    "qudurat",
    "gifted_screening",
    "mawhiba_annual",
    "other",
  ];
  const achievementClassification = allowedClass.includes(achievementClassificationRaw)
    ? achievementClassificationRaw
    : "other";
  let achievementName = sanitizeUserText(String(body.achievementName || "").trim()) || "";
  const nameAr = sanitizeUserText(String(body.nameAr || "").trim()) || undefined;
  const nameEn = sanitizeUserText(String(body.nameEn || "").trim()) || undefined;
  const customAchievementName =
    sanitizeUserText(String(body.customAchievementName || "").trim()) || undefined;
  let achievementLevel = String(body.achievementLevel || "");
  let participationType = String(body.participationType || "individual");
  let resultType = String(body.resultType || "");

  if (achievementType === "gifted_discovery") {
    achievementName = "exceptional_gifted";
    resultType = "participation";
    participationType = "individual";
  }

  if (achievementType === "mawhiba_annual") {
    achievementLevel = "kingdom";
    resultType = "rank";
    if (String(body.mawhibaAnnualRank || "").trim()) {
      achievementName = String(body.mawhibaAnnualRank || "").trim();
    }
  }

  if (achievementType === "qudrat") {
    achievementLevel = "kingdom";
    resultType = "participation";
    participationType = "individual";
    if (String(body.achievementName || "").trim()) {
      achievementName = normalizeLegacyQudratAchievementName(String(body.achievementName || "").trim());
    }
  }

  if (achievementType === "sat" || achievementType === "ielts" || achievementType === "toefl") {
    achievementLevel = "international";
    resultType = "score";
    participationType = "individual";
    if (!achievementName.trim()) {
      achievementName = achievementType;
    }
  }

  const evidenceUrl = String(body.evidenceUrl || "").trim() || undefined;
  const evidenceFileName = String(body.evidenceFileName || "").trim() || undefined;
  const image = String(body.image || "").trim() || undefined;
  const imagePublicId = String(body.imagePublicId || "").trim() || undefined;
  const attachments = Array.isArray(body.attachments)
    ? normalizeAttachmentsArray(body.attachments)
    : undefined;

  const hasEvidence = Boolean(evidenceUrl || evidenceFileName || image || (attachments && attachments.length > 0));
  const evidenceRequiredMode: "provided" | "skipped" =
    body.evidenceRequiredMode === "skipped" ? "skipped" : "provided";
  const requiresCommitteeReview = evidenceRequiredMode === "skipped";

  const verificationStatus: "unverified" | "pending_committee_review" = requiresCommitteeReview
    ? "pending_committee_review"
    : "unverified";

  const verificationSummary = requiresCommitteeReview
    ? "Evidence skipped by student. Requires committee review."
    : hasEvidence
      ? "Initial evidence metadata captured."
      : "No evidence metadata.";

  return {
    achievementType,
    achievementCategory,
    achievementClassification,
    achievementName,
    nameAr,
    nameEn,
    customAchievementName,
    achievementLevel,
    participationType,
    teamRole: sanitizeUserText(String(body.teamRole || "").trim()) || undefined,
    resultType,
    resultValue: sanitizeUserText(String(body.resultValue || "").trim()) || undefined,
    medalType: sanitizeUserText(String(body.medalType || "").trim()) || undefined,
    rank: sanitizeUserText(String(body.rank || "").trim()) || undefined,
    nominationText: sanitizeUserText(String(body.nominationText || "").trim()) || undefined,
    specialAwardText: sanitizeUserText(String(body.specialAwardText || "").trim()) || undefined,
    recognitionText: sanitizeUserText(String(body.recognitionText || "").trim()) || undefined,
    otherResultText: sanitizeUserText(String(body.otherResultText || "").trim()) || undefined,
    olympiadField: sanitizeUserText(String(body.olympiadField || "").trim()) || undefined,
    mawhibaAnnualSubject: sanitizeUserText(String(body.mawhibaAnnualSubject || "").trim()) || undefined,
    giftedDiscoveryScore:
      typeof body.giftedDiscoveryScore === "number"
        ? body.giftedDiscoveryScore
        : body.giftedDiscoveryScore
          ? Number(body.giftedDiscoveryScore)
          : undefined,
    achievementYear: (() => {
      const ds = String(body.achievementDate || "").trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(ds)) {
        const d = new Date(ds.slice(0, 10));
        if (!isNaN(d.getTime())) return d.getFullYear();
      }
      if (typeof body.achievementYear === "number") return body.achievementYear;
      const n = Number(body.achievementYear);
      return !isNaN(n) && n > 1900 ? n : new Date().getFullYear();
    })(),
    achievementDate: String(body.achievementDate || "").trim().slice(0, 10) || undefined,
    description: sanitizeUserText(String(body.description || "").trim()) || undefined,
    image,
    imagePublicId,
    attachments,
    evidenceUrl,
    evidenceFileName,
    evidenceRequiredMode,
    requiresCommitteeReview,
    verificationStatus,
    verificationSummary,
    evidenceMatchStatus: "unknown",
    evidenceExtractedData: hasEvidence
      ? {
          evidenceUrl: evidenceUrl || null,
          evidenceFileName: evidenceFileName || null,
          hasImage: Boolean(image),
          attachmentsCount: attachments?.length || 0,
        }
      : null,
    featured: body.featured === true,
  };
};

export const validateNormalizedPayload = (payload: NormalizedPayload): string[] => {
  const errors: string[] = [];

  if (!payload.achievementType) errors.push("Achievement type is required");
  if (!payload.achievementName && !payload.customAchievementName) errors.push("Achievement name is required");
  if (!payload.achievementLevel) errors.push("Achievement level is required");
  if (!payload.resultType) errors.push("Result type is required");

  if (payload.participationType === "team" && !payload.teamRole) {
    errors.push("Team role is required for team participation");
  }

  if (payload.participationType === "individual") {
    payload.teamRole = undefined;
  }

  if (payload.achievementType === "gifted_discovery") {
    if (!payload.giftedDiscoveryScore || payload.giftedDiscoveryScore <= 1600) {
      errors.push("Gifted discovery score must be greater than 1600");
    }
  }

  if (payload.achievementType === "mawhiba_annual") {
    if (!payload.rank) errors.push("Mawhiba annual rank is required");
    if (!payload.mawhibaAnnualSubject) errors.push("Mawhiba annual subject is required");
  }

  if (
    payload.achievementType === "qudrat" &&
    !(QUDRAT_TIER_ALLOWED_VALUES as readonly string[]).includes(payload.achievementName)
  ) {
    errors.push(
      "Qudrat tier must be one of: qudrat_95 … qudrat_100"
    );
  }

  if (
    payload.achievementType === "sat" ||
    payload.achievementType === "ielts" ||
    payload.achievementType === "toefl"
  ) {
    if (!String(payload.resultValue || "").trim()) {
      errors.push("Test score (result value) is required for SAT / IELTS / TOEFL");
    }
  }

  if (payload.resultType === "medal" && !payload.medalType) errors.push("Medal type is required for medal result");
  if (payload.resultType === "rank" && !payload.rank) errors.push("Rank is required for rank result");
  if (payload.resultType === "nomination" && !payload.nominationText) {
    errors.push("Nomination text is required for nomination result");
  }
  if (payload.resultType === "special_award" && !payload.specialAwardText) {
    errors.push("Special award text is required for special award result");
  }
  if (payload.resultType === "recognition" && !payload.recognitionText) {
    errors.push("Recognition text is required for recognition result");
  }
  if (payload.resultType === "other" && !payload.otherResultText) {
    errors.push("Other result text is required for other result type");
  }

  const hasEvidence = Boolean(
    payload.evidenceUrl || payload.evidenceFileName || payload.image || (payload.attachments && payload.attachments.length > 0)
  );
  if (payload.evidenceRequiredMode !== "skipped" && !hasEvidence) {
    errors.push("Evidence is required: provide file/link or choose committee review");
  }

  return errors;
};

import {
  canStudentViewCertificate,
  isAchievementCertificateEligible,
  isLegacyCertificateRecord,
  labelCertificateIssuerRole,
  resolveCertificateUiStatus,
} from "@/lib/certificate-eligibility";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { serializeAttachmentsForStudentApi } from "@/lib/achievement-attachments";
import { isStudentEditLocked, resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";

/**
 * Shared JSON shape for GET /api/achievements/[id] and GET /api/admin/achievements/[id].
 * Used by the achievement details page (student + reviewer).
 */
export const buildStudentAchievementDetailPayload = (
  raw: unknown
): Record<string, unknown> => {
  const achievement = raw as Record<string, unknown> & {
    _id?: { toString(): string };
    date?: Date;
    createdAt?: Date;
    achievementYear?: number;
    nameAr?: string;
    nameEn?: string;
    achievementName?: string;
    title?: string;
    customAchievementName?: string;
    achievementLevel?: string;
    level?: string;
    inferredField?: string;
    domain?: string;
    achievementType?: string;
    achievementCategory?: string;
    resultType?: string;
    medalType?: string;
    rank?: string;
    resultValue?: string;
    participationType?: string;
    description?: string;
    score?: number;
    verificationStatus?: string;
    evidenceRequiredMode?: string;
    requiresCommitteeReview?: boolean;
    featured?: boolean;
    approved?: boolean;
    image?: string | null;
    evidenceUrl?: string;
    evidenceFileName?: string;
    organization?: string;
    programName?: string;
    customProgramName?: string;
    competitionName?: string;
    customCompetitionName?: string;
    exhibitionName?: string;
    customExhibitionName?: string;
    olympiadMeeting?: string;
    attachments?: unknown;
  };
  const achAny = achievement as Record<string, unknown>;
  const pendingReReview = achAny.pendingReReview === true;
  const reviewComments = Array.isArray(achAny.reviewComments) ? achAny.reviewComments : [];
  const verifyToken =
    typeof achAny.certificateVerificationToken === "string" ? achAny.certificateVerificationToken : "";
  const certificateIssued = achAny.certificateIssued === true;
  const certLike = achievement as unknown as Parameters<typeof canStudentViewCertificate>[0];
  const certificateAvailable = canStudentViewCertificate(certLike);
  const certificateEligible = isAchievementCertificateEligible(certLike);
  const certificateLegacy = isLegacyCertificateRecord(certLike);
  const certificateStatus = resolveCertificateUiStatus(certLike);
  const certificateIssuedAtIso =
    achAny.certificateIssuedAt instanceof Date
      ? achAny.certificateIssuedAt.toISOString()
      : achAny.certificateIssuedAt
        ? String(achAny.certificateIssuedAt)
        : null;
  const certificateApprovedByRole =
    typeof achAny.certificateApprovedByRole === "string" ? achAny.certificateApprovedByRole : null;
  const loc = "ar" as const;
  const certificateIssuerLabelAr = labelCertificateIssuerRole(certificateApprovedByRole, loc);
  const certificateIssuerLabelEn = labelCertificateIssuerRole(certificateApprovedByRole, "en");
  const editLocked = isStudentEditLocked(achAny);

  const safeDate =
    achievement.date instanceof Date
      ? achievement.date
      : achievement.createdAt instanceof Date
        ? achievement.createdAt
        : achievement.achievementYear
          ? new Date(`${achievement.achievementYear}-01-01`)
          : null;

  const safeName =
    achievement.nameAr ||
    achievement.nameEn ||
    achievement.achievementName ||
    achievement.title ||
    achievement.customAchievementName ||
    "Achievement";

  const normalizedLevel = achievement.achievementLevel || achievement.level || "";
  const safeField = achievement.inferredField || achievement.domain || "";
  const achievementAny = achievement as Record<string, unknown>;
  const approvalStatus =
    achievementAny.approvalStatus ||
    resolveWorkflowDisplayStatus({
      status: achievementAny.status as string | undefined,
      isFeatured: achievementAny.isFeatured as boolean | undefined,
      featured: achievement.featured as boolean | undefined,
      approved: achievement.approved as boolean | undefined,
      verificationStatus: achievement.verificationStatus as string | undefined,
      pendingReReview,
    });

  const ws = achAny.workflowState as { resubmittedByStudent?: boolean } | undefined;
  const resubmittedByStudent = ws?.resubmittedByStudent === true;
  const { attachments: attachmentUrls, attachmentItems } = serializeAttachmentsForStudentApi(
    achievement.attachments
  );

  return {
    id: achievement._id?.toString?.() ?? "",
    title: safeName,
    name: safeName,
    achievementName: safeName,
    nameAr: achievement.nameAr || safeName,
    nameEn: achievement.nameEn || safeName,
    achievementType: achievement.achievementType || "",
    achievementCategory: achievement.achievementCategory || achievement.achievementType || "competition",
    achievementLevel: normalizedLevel,
    level: normalizedLevel,
    resultType: achievement.resultType || "",
    medalType: achievement.medalType || "",
    rank: achievement.rank || "",
    resultValue:
      achievement.resultValue ||
      (achievement.medalType
        ? achievement.medalType
        : achievement.rank
          ? achievement.rank
          : achievement.resultType || ""),
    participationType: achievement.participationType || "",
    achievementClassification: (achievementAny.achievementClassification as string) || "",
    attachments: attachmentUrls,
    attachmentItems,
    resubmittedByStudent,
    inferredField: safeField,
    domain: safeField,
    description: sanitizeUserText(achievement.description || ""),
    score: achievement.score || 0,
    verificationStatus: achievement.verificationStatus || "unverified",
    evidenceRequiredMode: achievement.evidenceRequiredMode || "provided",
    requiresCommitteeReview: achievement.requiresCommitteeReview || false,
    approvalStatus,
    status: (achievementAny.status as string) || (achievement.approved ? "approved" : "pending"),
    isFeatured: achievementAny.isFeatured === true || achievement.featured === true,
    featured: achievement.featured || false,
    approved: achievement.approved || false,
    image: achievement.image || null,
    evidenceUrl: achievement.evidenceUrl || "",
    evidenceFileName: achievement.evidenceFileName || "",
    date: safeDate ? safeDate.toISOString().split("T")[0] : "",
    year: achievement.achievementYear || (safeDate ? safeDate.getFullYear() : null),
    createdAt: achievement.createdAt,
    updatedAt: achievement.updatedAt,
    reviewNote: achievementAny.reviewNote || "",
    reviewComments,
    aiReviewStatus: achievementAny.aiReviewStatus,
    aiFlags: achievementAny.aiFlags,
    aiSummary: achievementAny.aiSummary,
    aiConfidence: achievementAny.aiConfidence,
    aiSuggestedAction: achievementAny.aiSuggestedAction,
    certificateIssued,
    certificateId: achievementAny.certificateId || null,
    certificateVerificationUrl: verifyToken ? `/verify/certificate/${verifyToken}` : null,
    certificateAvailable,
    certificateEligible,
    certificateLegacy,
    certificateStatus,
    certificateIssuedAt: certificateIssuedAtIso,
    certificateApprovedByRole,
    certificateIssuerLabelAr,
    certificateIssuerLabelEn,
    principalApprovedAt: achAny.principalApprovedAt || null,
    activitySupervisorApprovedAt: achAny.activitySupervisorApprovedAt || null,
    adminApprovedAt: achAny.adminApprovedAt || null,
    judgeApprovedAt: achAny.judgeApprovedAt || null,
    certificateApprovedAt: achAny.certificateApprovedAt || null,
    certificateRevokedAt: achAny.certificateRevokedAt || null,
    editLocked,
    pendingReReview,
    lastStudentEditAt: achAny.lastStudentEditAt || null,
    lastEditedByRole: achAny.lastEditedByRole || null,
    changedFields: Array.isArray(achAny.changedFields) ? achAny.changedFields : [],
    previousApprovedSnapshot: achAny.previousApprovedSnapshot || null,
    organization: achievement.organization || "",
    programName: achievement.programName || "",
    customProgramName: achievement.customProgramName || "",
    competitionName: achievement.competitionName || "",
    customCompetitionName: achievement.customCompetitionName || "",
    exhibitionName: achievement.exhibitionName || "",
    customExhibitionName: achievement.customExhibitionName || "",
    olympiadMeeting: achievement.olympiadMeeting || "",
    customAchievementName: achievement.customAchievementName || "",
  };
};

import { extractAttachmentUrl } from "@/lib/achievement-attachments";
import type { AdminAchievementDetailApi, AdminAchievementReviewListRow } from "@/types/admin-achievement-review";

/** Build list-row shape from detail API for shared action buttons / eligibility checks. */
export const detailApiToListRow = (detail: AdminAchievementDetailApi): AdminAchievementReviewListRow => {
  const a = detail.achievement;
  const safeName =
    String(a.nameAr || "") ||
    String(a.nameEn || "") ||
    String(a.achievementName || "") ||
    String(a.title || "") ||
    "Achievement";
  const atts = Array.isArray(a.attachments)
    ? a.attachments.map((x) => extractAttachmentUrl(x)).filter((x): x is string => Boolean(x))
    : [];
  const ws = a.workflowState as { resubmittedByStudent?: boolean } | undefined;
  const img = typeof a.image === "string" && a.image.trim() ? a.image : null;
  const st = String(a.status || ((a.approved as boolean) ? "approved" : "pending"));
  const user = detail.student;

  const safeDate =
    a.date instanceof Date
      ? a.date
      : a.createdAt instanceof Date
        ? a.createdAt
        : a.achievementYear
          ? new Date(`${a.achievementYear}-01-01`)
          : null;

  return {
    id: String(detail.id || a._id || ""),
    title: safeName,
    nameAr: (a.nameAr as string | undefined) || "",
    nameEn: (a.nameEn as string | undefined) || "",
    achievementName: (a.achievementName as string | undefined) || "",
    customAchievementName: (a.customAchievementName as string | undefined) || "",
    achievementType: a.achievementType as string | undefined,
    achievementCategory: a.achievementCategory as string | undefined,
    achievementClassification: (a as { achievementClassification?: string }).achievementClassification,
    achievementLevel: (a.achievementLevel || a.level) as string | undefined,
    inferredField: (a.inferredField || a.domain) as string | undefined,
    organization: (a.organization as string | undefined) || "",
    competitionName: (a.competitionName as string | undefined) || "",
    programName: (a.programName as string | undefined) || "",
    exhibitionName: (a.exhibitionName as string | undefined) || "",
    customCompetitionName: (a.customCompetitionName as string | undefined) || "",
    participationType: (a.participationType as string | undefined) || "",
    resultType: (a.resultType as string | undefined) || "",
    medalType: (a.medalType as string | undefined) || "",
    rank: (a.rank as string | undefined) || "",
    resultValue: (a.resultValue as string | undefined) || "",
    nominationText: (a.nominationText as string | undefined) || "",
    specialAwardText: (a.specialAwardText as string | undefined) || "",
    attachments: atts,
    attachmentsCount: atts.length + (img ? 1 : 0),
    date: safeDate ? safeDate.toISOString().split("T")[0] : "",
    updatedAt: (a.updatedAt as string | null) || null,
    lastStudentEditAt: (a.lastStudentEditAt as string | null) || null,
    lastEditedByRole: (a.lastEditedByRole as string | undefined) || "",
    editVersion: typeof a.editVersion === "number" ? a.editVersion : 0,
    image: img,
    status: st,
    isFeatured: a.isFeatured === true,
    pendingReReview: detail.computed.pendingReReview,
    resubmittedByStudent: ws?.resubmittedByStudent === true,
    approvalStatus: detail.computed.approvalStatus,
    reviewNote: (a.reviewNote as string | undefined) || "",
    aiReviewStatus: a.aiReviewStatus as string | undefined,
    aiFlags: Array.isArray(a.aiFlags) ? (a.aiFlags as string[]) : [],
    aiSummary: (a.aiSummary as string) || "",
    aiSuggestedAction: a.aiSuggestedAction as string | undefined,
    aiConfidence: typeof a.aiConfidence === "number" ? a.aiConfidence : null,
    principalApprovedAt: (a.principalApprovedAt as string | null) || null,
    activitySupervisorApprovedAt: (a.activitySupervisorApprovedAt as string | null) || null,
    adminApprovedAt: (a.adminApprovedAt as string | null) || null,
    judgeApprovedAt: (a.judgeApprovedAt as string | null) || null,
    certificateIssued: a.certificateIssued === true,
    certificateRevokedAt: (a.certificateRevokedAt as string | null) || null,
    certificateApprovedByRole: (a.certificateApprovedByRole as string | null) || null,
    certificateApprovedAt: (a.certificateApprovedAt as string | null) || null,
    certificateIssuedAt: (a.certificateIssuedAt as string | null) || null,
    adminAttachmentOverall: (() => {
      const ar = a.adminAttachmentAiReview as { overallMatchStatus?: string } | undefined;
      const o = ar && typeof ar.overallMatchStatus === "string" ? ar.overallMatchStatus : "";
      return o || null;
    })(),
    adminAttachmentAiReview: (a.adminAttachmentAiReview as Record<string, unknown> | null) ?? null,
    adminDuplicateMarked: a.adminDuplicateMarked === true,
    student: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      grade: user?.grade || "",
      section: user?.section || "",
    },
  };
};

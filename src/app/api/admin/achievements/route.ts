import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { requireAchievementReviewer } from "@/lib/review-auth";
import {
  buildAdminAchievementListFilter,
  type AdminAchievementTab,
} from "@/lib/adminAchievementListQuery";
import { resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import {
  type AchievementCertificateLike,
  isAchievementCertificateEligible,
  resolveCertificateUiStatus,
} from "@/lib/certificate-eligibility";
import { isAiReviewUiEnabled } from "@/lib/ai-review-ui";
import { isAiAssistEnabled } from "@/lib/openai-env";
import { batchYearDuplicateHintsForAchievements } from "@/lib/achievement-admin-duplicate-batch";
import {
  compareAiAlertListRows,
  type AdminAiAlertListRowInput,
} from "@/lib/admin-ai-alert-review-view-model";
import { extractAttachmentUrl } from "@/lib/achievement-attachments";

export const dynamic = "force-dynamic";

const tabFromParam = (v: string | null): AdminAchievementTab => {
  if (
    v === "pending" ||
    v === "needs_revision" ||
    v === "approved" ||
    v === "featured" ||
    v === "pending_re_review" ||
    v === "ai_flagged" ||
    v === "duplicate" ||
    v === "level_mismatch" ||
    v === "attachment_ai_mismatch" ||
    v === "attachment_ai_unclear" ||
    v === "attachment_ai_match" ||
    v === "no_attachments" ||
    v === "admin_duplicate_marked" ||
    v === "rejected" ||
    v === "all"
  ) {
    return v;
  }
  return "all";
};

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();

    const { searchParams } = request.nextUrl;
    const tab = tabFromParam(searchParams.get("tab"));
    const q = String(searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;

    const baseFilter = buildAdminAchievementListFilter(tab);
    const andParts: Record<string, unknown>[] = [baseFilter];

    if (q) {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(esc, "i");
      const nameUsers = await User.find({
        $or: [{ fullName: rx }, { email: rx }, { username: rx }],
      })
        .select("_id")
        .limit(80)
        .lean();
      const userIds = nameUsers.map((u) => u._id);

      andParts.push({
        $or: [
          { nameAr: rx },
          { nameEn: rx },
          { title: rx },
          { achievementName: rx },
          { achievementType: rx },
          { achievementCategory: rx },
          ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ],
      });
    }

    const mongoFilter =
      andParts.length === 1 ? andParts[0] : { $and: andParts };

    const total = await Achievement.countDocuments(mongoFilter);

    const sort =
      tab === "pending_re_review"
        ? ({ lastStudentEditAt: -1, updatedAt: -1, createdAt: -1 } as Record<string, 1 | -1>)
        : ({ createdAt: -1 } as Record<string, 1 | -1>);

    const rows = await Achievement.find(mongoFilter).sort(sort).skip(skip).limit(limit).lean();

    const duplicateYearHintsMap =
      tab === "ai_flagged"
        ? await batchYearDuplicateHintsForAchievements(rows as unknown as Record<string, unknown>[])
        : null;

    const populatedRows = await Achievement.populate(rows, {
      path: "userId",
      select: "fullName email grade section",
    });

    type BuiltItem = Record<string, unknown>;

    const itemsUnsorted: BuiltItem[] = populatedRows.map((row) => {
      const achievement = row as unknown as Record<string, unknown>;
      const user = achievement.userId as {
        fullName?: string;
        email?: string;
        grade?: string;
        section?: string;
      } | null;
      const safeName =
        (achievement.nameAr as string) ||
        (achievement.nameEn as string) ||
        (achievement.achievementName as string) ||
        (achievement.title as string) ||
        "Achievement";
      const safeDate =
        achievement.date instanceof Date
          ? achievement.date
          : achievement.createdAt instanceof Date
            ? achievement.createdAt
            : achievement.achievementYear
              ? new Date(`${achievement.achievementYear}-01-01`)
              : null;

      const pendingReReview = achievement.pendingReReview === true;
      const approvalStatus = resolveWorkflowDisplayStatus({
        status: achievement.status as string | undefined,
        isFeatured: achievement.isFeatured as boolean | undefined,
        featured: achievement.featured as boolean | undefined,
        approved: achievement.approved as boolean | undefined,
        verificationStatus: achievement.verificationStatus as string | undefined,
        pendingReReview,
      });

      const img = achievement.image;
      const imageOut = typeof img === "string" && img.trim() ? img : null;
      const attsRaw = Array.isArray(achievement.attachments) ? achievement.attachments : [];
      const atts = attsRaw
        .map((x) => extractAttachmentUrl(x))
        .filter((x): x is string => Boolean(x));
      const ws = achievement.workflowState as { resubmittedByStudent?: boolean } | undefined;
      const resubmittedByStudent = ws?.resubmittedByStudent === true;
      const sectionLabel =
        user?.section === "arabic"
          ? "عربي"
          : user?.section === "international"
            ? "دولي"
            : user?.section || "";

      return {
        id: String(achievement._id),
        title: safeName,
        nameAr: (achievement.nameAr as string | undefined) || "",
        nameEn: (achievement.nameEn as string | undefined) || "",
        achievementName: (achievement.achievementName as string | undefined) || "",
        customAchievementName: (achievement.customAchievementName as string | undefined) || "",
        achievementType: achievement.achievementType as string | undefined,
        achievementCategory: achievement.achievementCategory as string | undefined,
        achievementClassification: (achievement as { achievementClassification?: string })
          .achievementClassification,
        achievementLevel: (achievement.achievementLevel || achievement.level) as string | undefined,
        inferredField: (achievement.inferredField || achievement.domain) as string | undefined,
        organization: (achievement.organization as string | undefined) || "",
        competitionName: (achievement.competitionName as string | undefined) || "",
        programName: (achievement.programName as string | undefined) || "",
        exhibitionName: (achievement.exhibitionName as string | undefined) || "",
        customCompetitionName: (achievement.customCompetitionName as string | undefined) || "",
        participationType: (achievement.participationType as string | undefined) || "",
        resultType: (achievement.resultType as string | undefined) || "",
        medalType: (achievement.medalType as string | undefined) || "",
        rank: (achievement.rank as string | undefined) || "",
        resultValue: (achievement.resultValue as string | undefined) || "",
        nominationText: (achievement.nominationText as string | undefined) || "",
        specialAwardText: (achievement.specialAwardText as string | undefined) || "",
        attachments: atts,
        attachmentsCount: atts.length + (imageOut ? 1 : 0),
        date: safeDate ? safeDate.toISOString().split("T")[0] : "",
        updatedAt: achievement.updatedAt || null,
        lastStudentEditAt: achievement.lastStudentEditAt || null,
        lastEditedByRole: (achievement.lastEditedByRole as string | undefined) || "",
        editVersion: typeof achievement.editVersion === "number" ? achievement.editVersion : 0,
        image: imageOut,
        status: achievement.status || ((achievement.approved as boolean) ? "approved" : "pending"),
        isFeatured: achievement.isFeatured === true,
        featured: achievement.featured === true,
        approved: achievement.approved === true,
        pendingReReview,
        resubmittedByStudent,
        approvalStatus,
        reviewedAt: achievement.reviewedAt || null,
        featuredAt: achievement.featuredAt || null,
        reviewNote: (achievement.reviewNote as string | undefined) || "",
        aiReviewStatus: achievement.aiReviewStatus as string | undefined,
        aiFlags: Array.isArray(achievement.aiFlags) ? achievement.aiFlags : [],
        aiSummary: (achievement.aiSummary as string) || "",
        aiSuggestedAction: achievement.aiSuggestedAction as string | undefined,
        aiConfidence: typeof achievement.aiConfidence === "number" ? achievement.aiConfidence : null,
        adminAttachmentOverall: (() => {
          const ar = achievement.adminAttachmentAiReview as { overallMatchStatus?: string } | undefined;
          const o = ar && typeof ar.overallMatchStatus === "string" ? ar.overallMatchStatus : "";
          return o || null;
        })(),
        adminDuplicateMarked: achievement.adminDuplicateMarked === true,
        adminWorkflowNote: String((achievement as { adminWorkflowNote?: string }).adminWorkflowNote || ""),
        principalApprovedAt: achievement.principalApprovedAt || null,
        activitySupervisorApprovedAt: achievement.activitySupervisorApprovedAt || null,
        adminApprovedAt: achievement.adminApprovedAt || null,
        judgeApprovedAt: achievement.judgeApprovedAt || null,
        certificateIssued: achievement.certificateIssued === true,
        certificateRevokedAt: achievement.certificateRevokedAt || null,
        certificateApprovedByRole: achievement.certificateApprovedByRole || null,
        certificateApprovedAt: achievement.certificateApprovedAt || null,
        certificateIssuedAt: achievement.certificateIssuedAt || null,
        certificateStatus: resolveCertificateUiStatus(achievement as unknown as AchievementCertificateLike),
        certificateEligible: isAchievementCertificateEligible(achievement as unknown as AchievementCertificateLike),
        student: {
          fullName: user?.fullName || "",
          email: user?.email || "",
          grade: user?.grade || "",
          section: sectionLabel,
        },
        duplicateYearHint:
          tab === "ai_flagged" && duplicateYearHintsMap
            ? duplicateYearHintsMap.get(String(achievement._id)) ?? {
                hasYearDuplicate: false,
                yearDuplicateCount: 0,
              }
            : null,
        adminAttachmentAiReview:
          tab === "ai_flagged"
            ? ((achievement.adminAttachmentAiReview as Record<string, unknown> | null) ?? null)
            : undefined,
      };
    });

    const items: BuiltItem[] =
      tab === "ai_flagged"
        ? [...itemsUnsorted].sort((a, b) => {
            const toInput = (it: BuiltItem): AdminAiAlertListRowInput => ({
              id: String(it.id),
              title: String(it.title || ""),
              achievementType: it.achievementType as string | undefined,
              achievementCategory: it.achievementCategory as string | undefined,
              achievementClassification: it.achievementClassification as string | undefined,
              achievementLevel: it.achievementLevel as string | undefined,
              competitionName: it.competitionName as string | undefined,
              programName: it.programName as string | undefined,
              exhibitionName: it.exhibitionName as string | undefined,
              customCompetitionName: it.customCompetitionName as string | undefined,
              customAchievementName: it.customAchievementName as string | undefined,
              achievementName: it.achievementName as string | undefined,
              nameAr: it.nameAr as string | undefined,
              nameEn: it.nameEn as string | undefined,
              student: it.student as { fullName: string },
              adminAttachmentOverall: (it.adminAttachmentOverall as string | null) ?? null,
              adminAttachmentAiReview: (it.adminAttachmentAiReview as Record<string, unknown> | null) ?? null,
              adminDuplicateMarked: it.adminDuplicateMarked === true,
              aiFlags: Array.isArray(it.aiFlags) ? (it.aiFlags as string[]) : [],
              aiReviewStatus: it.aiReviewStatus as string | undefined,
              duplicateYearHint: it.duplicateYearHint as AdminAiAlertListRowInput["duplicateYearHint"],
            });
            return compareAiAlertListRows(toInput(a), toInput(b));
          })
        : itemsUnsorted;

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      tab,
      meta: {
        aiReviewUiEnabled: isAiReviewUiEnabled(),
        aiAssistEnabled: isAiAssistEnabled(),
      },
    });
  } catch (e) {
    console.error("[GET /api/admin/achievements]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

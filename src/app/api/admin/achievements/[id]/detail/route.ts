import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { buildDuplicateReviewSummaryForAchievement } from "@/lib/achievement-admin-duplicate-review";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { isAiAssistEnabled, logOpenAiRuntimeDiagnostics } from "@/lib/openai-env";
import { isAiReviewUiEnabled } from "@/lib/ai-review-ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const doc = await Achievement.findById(id)
      .populate("userId", "fullName fullNameAr fullNameEn email grade section studentId username")
      .lean();

    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const a = doc as unknown as Record<string, unknown>;
    const user = a.userId as Record<string, unknown> | null;
    const pendingReReview = a.pendingReReview === true;
    const approvalStatus = resolveWorkflowDisplayStatus({
      status: a.status as string | undefined,
      isFeatured: a.isFeatured as boolean | undefined,
      featured: a.featured as boolean | undefined,
      approved: a.approved as boolean | undefined,
      verificationStatus: a.verificationStatus as string | undefined,
      pendingReReview,
    });

    const safeDate =
      a.date instanceof Date
        ? a.date
        : a.createdAt instanceof Date
          ? a.createdAt
          : a.achievementYear
            ? new Date(`${a.achievementYear}-01-01`)
            : null;

    const duplicateReview = await buildDuplicateReviewSummaryForAchievement(id);

    return NextResponse.json({
      id: String(a._id),
      achievement: {
        ...a,
        userId: undefined,
      },
      computed: {
        approvalStatus,
        pendingReReview,
        dateIso: safeDate ? safeDate.toISOString().split("T")[0] : "",
      },
      duplicateReview,
      student: user
        ? {
            fullName: String(user.fullName || user.fullNameAr || ""),
            fullNameAr: user.fullNameAr,
            fullNameEn: user.fullNameEn,
            email: String(user.email || ""),
            grade: String(user.grade || ""),
            section:
              user.section === "arabic"
                ? "عربي"
                : user.section === "international"
                  ? "دولي"
                  : String(user.section || ""),
            studentId: String(user.studentId || ""),
            username: String(user.username || ""),
          }
        : null,
      meta: {
        aiAssistEnabled: isAiAssistEnabled(),
        aiReviewUiEnabled: isAiReviewUiEnabled(),
      },
    });
  } catch (e) {
    console.error("[GET admin achievement detail]", e);
    return jsonInternalServerError(e);
  }
}

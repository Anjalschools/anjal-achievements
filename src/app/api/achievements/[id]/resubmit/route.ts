import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { applyAiReviewToDoc, runAchievementAiReview } from "@/lib/achievement-ai-review";
import { mergeResubmitWorkflowState } from "@/lib/achievement-workflow-state";
import { createStudentNotification } from "@/lib/student-notifications";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const id = params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
    }

    const currentUser = await getCurrentDbUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    const doc = await Achievement.findOne({ _id: id, userId: currentUser._id });
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    if (doc.status !== "needs_revision" && doc.status !== "rejected") {
      return NextResponse.json(
        { error: "Resubmit is only available after revision request or rejection" },
        { status: 400 }
      );
    }

    const fromNeedsRevision = doc.status === "needs_revision";
    /** After admin revision request: explicit `pending_review` + workflowState. After rejection: back to `pending`. */
    doc.set("status", fromNeedsRevision ? "pending_review" : "pending");
    doc.set(
      "workflowState",
      mergeResubmitWorkflowState(doc.get("workflowState"), {
        fromNeedsRevision,
        lastAction: "resubmitted_after_edit",
      })
    );
    const comments = Array.isArray(doc.reviewComments) ? [...doc.reviewComments] : [];
    comments.push({
      authorId: currentUser._id,
      authorRole: "student",
      message: "Resubmitted for review after edits.",
      type: "resubmit" as const,
      createdAt: new Date(),
    });
    doc.set("reviewComments", comments);

    const finalName = String(
      doc.achievementName || doc.title || doc.customAchievementName || ""
    ).trim();

    const ai = await runAchievementAiReview({
      userId: String(currentUser._id),
      achievementId: doc._id.toString(),
      achievementYear: Number(doc.achievementYear),
      achievementName: finalName,
      achievementLevel: String(doc.achievementLevel || doc.level || ""),
      achievementType: String(doc.achievementType || ""),
      resultType: String(doc.resultType || ""),
      locale: "ar",
    });
    applyAiReviewToDoc(doc, ai);
    await doc.save();

    await logAuditEvent({
      actionType: "achievement_resubmitted_for_review",
      entityType: "achievement",
      entityId: doc._id.toString(),
      entityTitle: String(doc.get("nameAr") || doc.get("nameEn") || doc.get("achievementName") || doc.get("title") || "")
        .trim()
        .slice(0, 200) || undefined,
      descriptionAr: "إعادة إرسال الإنجاز للمراجعة بعد تعديل الطالب.",
      actor: actorFromUser(currentUser as any),
      metadata: {
        fromNeedsRevision,
        nextStatus: doc.get("status"),
        aiReviewStatus: doc.get("aiReviewStatus"),
      },
      outcome: "success",
      platform: "website",
    });

    if (doc.aiReviewStatus === "flagged") {
      try {
        await createStudentNotification({
          userId: currentUser._id,
          type: "ai_flag_notice",
          title: "تنبيه مراجعة أولية بعد إعادة الإرسال",
          message:
            String(doc.aiSummary || "").trim() ||
            "تم رصد بعض الملاحظات الأولية على إدخالك. هذا تنبيه إرشادي وليس قراراً نهائياً.",
          relatedAchievementId: doc._id,
          metadata: { aiFlags: doc.aiFlags ?? [], aiSuggestedAction: doc.aiSuggestedAction },
        });
      } catch (notifyErr) {
        console.error("[resubmit ai_flag_notice]", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      status: doc.status,
      aiReviewStatus: doc.aiReviewStatus,
      aiFlags: doc.aiFlags,
    });
  } catch (e) {
    console.error("[PATCH resubmit]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose, { Types } from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { mergeReturnedForRevisionWorkflowState } from "@/lib/achievement-workflow-state";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  let body: { message?: string } = {};
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    body = {};
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const now = new Date();
    doc.set("pendingReReview", false);
    doc.set("previousApprovedSnapshot", undefined);
    doc.set("changedFields", []);
    doc.set("status", "needs_revision");
    doc.set("reviewNote", message.slice(0, 4000));
    doc.set("reviewedBy", gate.user._id);
    doc.set("reviewedAt", now);

    const comments = Array.isArray(doc.reviewComments) ? [...doc.reviewComments] : [];
    comments.push({
      authorId: gate.user._id,
      authorRole: String(gate.user.role || "reviewer"),
      message: message.slice(0, 4000),
      type: "revision_request" as const,
      createdAt: now,
    });
    doc.set("reviewComments", comments);
    doc.set("workflowState", mergeReturnedForRevisionWorkflowState(doc.get("workflowState")));

    await doc.save();

    try {
      await createStudentNotification({
        userId: doc.userId as Types.ObjectId,
        type: "achievement_needs_revision",
        title: "مطلوب تعديل على إحدى إنجازاتك",
        message: `المرجع طلب تعديلاً على «${achievementDisplayTitle(doc)}»: ${message.slice(0, 1200)}`,
        relatedAchievementId: doc._id,
        metadata: { reviewNote: message.slice(0, 2000) },
      });
    } catch (notifyErr) {
      console.error("[revision notification]", notifyErr);
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      status: doc.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH revision]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

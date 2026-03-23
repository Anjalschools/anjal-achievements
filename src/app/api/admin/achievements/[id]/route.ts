import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  let body: { reason?: string } = {};
  try {
    body = (await request.json()) as { reason?: string };
  } catch {
    body = {};
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const displayTitle = achievementDisplayTitle(doc);

    try {
      await createStudentNotification({
        userId: doc.userId,
        type: "achievement_deleted",
        title: "تم حذف إنجاز",
        message: `تم حذف الإنجاز «${displayTitle}» من قبل الإدارة. السبب: ${reason.slice(0, 1500)}`,
        relatedAchievementId: doc._id,
        metadata: {
          reason: reason.slice(0, 2000),
          deletedBy: gate.user._id.toString(),
          achievementTitle: displayTitle,
        },
      });
    } catch (notifyErr) {
      console.error("[delete notification]", notifyErr);
    }

    await Achievement.findByIdAndDelete(id);

    return NextResponse.json({ success: true, deleted: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[DELETE admin achievement]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

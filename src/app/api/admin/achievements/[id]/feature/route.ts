import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose, { Types } from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { isApprovedForFeature } from "@/lib/achievementWorkflow";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";
import { applyDefaultShowInPublicPortfolioWhenPublished } from "@/lib/achievement-public-portfolio-policy";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  try {
    await connectDB();
    let body: { featureNote?: string } = {};
    try {
      body = (await request.json()) as { featureNote?: string };
    } catch {
      body = {};
    }

    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    if (!isApprovedForFeature({ status: doc.status, approved: doc.approved })) {
      return NextResponse.json(
        { error: "Only approved achievements can be featured" },
        { status: 400 }
      );
    }
    if ((doc as { pendingReReview?: boolean }).pendingReReview === true) {
      return NextResponse.json(
        { error: "Re-review must be completed before featuring" },
        { status: 400 }
      );
    }

    doc.set("status", "approved");
    doc.set("isFeatured", true);
    doc.set("featuredAt", new Date());
    if (typeof body.featureNote === "string" && body.featureNote.trim()) {
      doc.set("featureNote", body.featureNote.trim().slice(0, 2000));
    }
    applyDefaultShowInPublicPortfolioWhenPublished(doc);
    await doc.save();

    try {
      await createStudentNotification({
        userId: doc.userId as Types.ObjectId,
        type: "achievement_featured",
        title: "تم تمييز إنجازك",
        message: `تم اختيار إنجازك «${achievementDisplayTitle(doc)}» كإنجاز بارز في المنصة.`,
        relatedAchievementId: doc._id,
      });
    } catch (notifyErr) {
      console.error("[feature notification]", notifyErr);
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      isFeatured: true,
      status: doc.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH feature]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

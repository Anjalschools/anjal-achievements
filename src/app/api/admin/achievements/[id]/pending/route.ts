import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    doc.set("pendingReReview", false);
    doc.set("previousApprovedSnapshot", undefined);
    doc.set("changedFields", []);
    doc.set("status", "pending");
    doc.set("isFeatured", false);
    doc.set("featured", false);
    doc.set("approved", false);
    doc.set("featuredAt", undefined);
    doc.set("reviewedBy", undefined);
    doc.set("reviewedAt", undefined);
    doc.set("lockedAt", undefined);
    doc.set("lockedBy", undefined);
    doc.set("adminApprovedAt", undefined);
    doc.set("adminApprovedBy", undefined);
    doc.set("principalApprovedAt", undefined);
    doc.set("principalApprovedBy", undefined);
    doc.set("activitySupervisorApprovedAt", undefined);
    doc.set("activitySupervisorApprovedBy", undefined);
    doc.set("judgeApprovedAt", undefined);
    doc.set("judgeApprovedBy", undefined);
    doc.set("certificateApprovedByRole", undefined);
    doc.set("certificateApprovedById", undefined);
    doc.set("certificateApprovedAt", undefined);
    doc.set("certificateRevokedAt", new Date());
    doc.set("certificateSnapshot", undefined);
    const prevTok =
      typeof doc.get("certificateVerificationToken") === "string"
        ? String(doc.get("certificateVerificationToken")).trim()
        : "";
    const superseded = Array.isArray(doc.get("certificateSupersededTokens"))
      ? [...(doc.get("certificateSupersededTokens") as string[])]
      : [];
    if (prevTok) superseded.push(prevTok);
    doc.set("certificateSupersededTokens", superseded);
    doc.set("certificateIssued", false);
    doc.set("certificateIssuedAt", undefined);
    doc.set("certificateId", undefined);
    doc.set("certificateVerificationToken", undefined);
    await doc.save();

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      status: "pending",
      isFeatured: false,
      featured: false,
      approved: false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH pending]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

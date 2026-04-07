import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { applyAchievementPlatformApproval } from "@/lib/achievement-approval-core";
import { getScoringConfig } from "@/lib/getScoringConfig";
import { tryIssueCertificateForAchievementDoc } from "@/lib/certificate-issue";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  if (String(gate.user.role || "") !== "judge") {
    return NextResponse.json({ error: "Forbidden — judge role required" }, { status: 403 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const now = new Date();
    const alreadyApproved = String(doc.status) === "approved";

    if (!alreadyApproved) {
      const scoringConfig = await getScoringConfig();
      applyAchievementPlatformApproval(doc, gate, now, {}, "judge", { scoringConfig });
    } else {
      doc.set("judgeApprovedAt", now);
      doc.set("judgeApprovedBy", gate.user._id);
      doc.set("certificateRevokedAt", undefined);
    }

    await doc.save();

    try {
      await tryIssueCertificateForAchievementDoc(doc, {
        role: "judge",
        userId: gate.user._id as mongoose.Types.ObjectId,
      });
    } catch (issueErr) {
      console.error("[approve-judge certificate issue]", issueErr);
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      judgeApprovedAt: doc.judgeApprovedAt,
      certificateIssued: doc.certificateIssued === true,
      certificateVerificationToken: doc.certificateVerificationToken,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH approve-judge]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { applyAchievementPlatformApproval } from "@/lib/achievement-approval-core";
import { tryIssueCertificateForAchievementDoc } from "@/lib/certificate-issue";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

/** Activity lead — not judge (judge uses main approve or approve-judge). */
const SUPERVISOR_ROLES = new Set(["admin", "teacher", "supervisor"]);

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!SUPERVISOR_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Forbidden — activity supervisor approval role required" },
      { status: 403 }
    );
  }

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

    const now = new Date();
    const alreadyApproved = String(doc.status) === "approved";

    if (!alreadyApproved) {
      applyAchievementPlatformApproval(doc, gate, now, {}, "activitySupervisor");
    } else {
      doc.set("activitySupervisorApprovedAt", now);
      doc.set("activitySupervisorApprovedBy", gate.user._id);
      doc.set("certificateRevokedAt", undefined);
    }

    await doc.save();

    try {
      await tryIssueCertificateForAchievementDoc(doc, {
        role: "activitySupervisor",
        userId: gate.user._id as mongoose.Types.ObjectId,
      });
    } catch (issueErr) {
      console.error("[approve-activity-supervisor certificate issue]", issueErr);
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      activitySupervisorApprovedAt: doc.activitySupervisorApprovedAt,
      certificateIssued: doc.certificateIssued === true,
      certificateVerificationToken: doc.certificateVerificationToken,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH approve-activity-supervisor]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

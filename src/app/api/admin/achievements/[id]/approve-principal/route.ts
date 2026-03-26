import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { applyAchievementPlatformApproval } from "@/lib/achievement-approval-core";
import { tryIssueCertificateForAchievementDoc } from "@/lib/certificate-issue";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const PRINCIPAL_ROLES = new Set(["admin", "schoolAdmin"]);

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!PRINCIPAL_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden — principal approval role required" }, { status: 403 });
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
      applyAchievementPlatformApproval(doc, gate, now, {}, "principal");
    } else {
      doc.set("principalApprovedAt", now);
      doc.set("principalApprovedBy", gate.user._id);
      doc.set("certificateRevokedAt", undefined);
    }

    await doc.save();

    try {
      await tryIssueCertificateForAchievementDoc(doc, {
        role: "principal",
        userId: gate.user._id as mongoose.Types.ObjectId,
      });
    } catch (issueErr) {
      console.error("[approve-principal certificate issue]", issueErr);
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      principalApprovedAt: doc.principalApprovedAt,
      certificateIssued: doc.certificateIssued === true,
      certificateVerificationToken: doc.certificateVerificationToken,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH approve-principal]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

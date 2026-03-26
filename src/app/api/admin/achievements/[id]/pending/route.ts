import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { pickApprovedSnapshot } from "@/lib/achievement-snapshot";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const before = doc.toObject() as unknown as Record<string, unknown>;
    const wasApproved = String(doc.get("status") || "") === "approved" || doc.get("approved") === true;
    const approvedSnapshot = wasApproved ? pickApprovedSnapshot(before) : undefined;

    doc.set("pendingReReview", false);
    // Keep snapshot for audit/comparison only (must NOT be used for display).
    if (approvedSnapshot && Object.keys(approvedSnapshot).length > 0) {
      doc.set("previousApprovedSnapshot", approvedSnapshot);
    }
    doc.set("changedFields", []);
    // After unapprove, allow student edits but force re-review.
    doc.set("status", "pending_review");
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

    await logAuditEvent({
      actionType: "achievement_unapproved",
      entityType: "achievement",
      entityId: doc._id.toString(),
      entityTitle: String(doc.get("nameAr") || doc.get("nameEn") || doc.get("achievementName") || doc.get("title") || "")
        .trim()
        .slice(0, 200) || undefined,
      descriptionAr: "إلغاء اعتماد إنجاز وإرجاعه للمراجعة مع إلغاء الشهادة (إن وجدت).",
      actor: actorFromUser(gate.user as any),
      before: {
        status: (before as any).status,
        approved: (before as any).approved,
        isFeatured: (before as any).isFeatured,
        featured: (before as any).featured,
        certificateIssued: (before as any).certificateIssued,
      },
      after: {
        status: doc.get("status"),
        approved: doc.get("approved"),
        isFeatured: doc.get("isFeatured"),
        featured: doc.get("featured"),
        certificateIssued: doc.get("certificateIssued"),
        certificateRevokedAt: doc.get("certificateRevokedAt"),
      },
      outcome: "success",
      platform: "website",
    });

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      status: "pending_review",
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

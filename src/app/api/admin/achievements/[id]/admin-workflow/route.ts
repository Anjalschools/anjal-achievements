import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

type Body = {
  action?:
    | "reject"
    | "mark_duplicate"
    | "unmark_duplicate"
    | "save_admin_note";
  message?: string;
  adminNote?: string;
};

const revokeCertificatesLikePending = (doc: mongoose.Document) => {
  doc.set("pendingReReview", false);
  doc.set("previousApprovedSnapshot", undefined);
  doc.set("changedFields", []);
  doc.set("isFeatured", false);
  doc.set("featured", false);
  doc.set("approved", false);
  doc.set("featuredAt", undefined);
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
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const action = String(body.action || "").trim();
  if (
    action !== "reject" &&
    action !== "mark_duplicate" &&
    action !== "unmark_duplicate" &&
    action !== "save_admin_note"
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const now = new Date();

    if (action === "save_admin_note") {
      const note =
        typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 4000) : "";
      doc.set("adminWorkflowNote", note);
      doc.set("lastAdminReviewedAt", now);
      await doc.save();
      return NextResponse.json({
        success: true,
        id: doc._id.toString(),
        adminWorkflowNote: note,
      });
    }

    if (action === "mark_duplicate") {
      doc.set("adminDuplicateMarked", true);
      doc.set("lastAdminReviewedAt", now);
      await doc.save();
      return NextResponse.json({ success: true, id: doc._id.toString(), adminDuplicateMarked: true });
    }

    if (action === "unmark_duplicate") {
      doc.set("adminDuplicateMarked", false);
      doc.set("lastAdminReviewedAt", now);
      await doc.save();
      return NextResponse.json({ success: true, id: doc._id.toString(), adminDuplicateMarked: false });
    }

    if (action === "reject") {
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
      }
      revokeCertificatesLikePending(doc);
      doc.set("status", "rejected");
      doc.set("reviewNote", message.slice(0, 4000));
      doc.set("reviewedBy", gate.user._id);
      doc.set("reviewedAt", now);
      doc.set("lockedAt", undefined);
      doc.set("lockedBy", undefined);
      doc.set("lastEditedByRole", "admin");
      doc.set("lastAdminReviewedAt", now);

      const comments = Array.isArray(doc.reviewComments) ? [...doc.reviewComments] : [];
      comments.push({
        authorId: gate.user._id,
        authorRole: String(gate.user.role || "reviewer"),
        message: message.slice(0, 4000),
        type: "admin_rejection" as const,
        createdAt: now,
      });
      doc.set("reviewComments", comments);

      await doc.save();

      try {
        await createStudentNotification({
          userId: doc.userId as mongoose.Types.ObjectId,
          type: "achievement_rejected",
          title: "تم رفض إحدى إنجازاتك",
          message: `تم رفض الإنجاز «${achievementDisplayTitle(doc)}»: ${message.slice(0, 1200)}`,
          relatedAchievementId: doc._id,
          metadata: { reviewNote: message.slice(0, 2000) },
        });
      } catch (notifyErr) {
        console.error("[admin-workflow reject notification]", notifyErr);
      }

      return NextResponse.json({
        success: true,
        id: doc._id.toString(),
        status: doc.status,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH admin-workflow]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

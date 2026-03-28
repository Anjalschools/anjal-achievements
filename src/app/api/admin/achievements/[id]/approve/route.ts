import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import {
  applyAchievementPlatformApproval,
  issuerKindFromReviewerRole,
} from "@/lib/achievement-approval-core";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";
import { tryIssueCertificateForAchievementDoc } from "@/lib/certificate-issue";
import { normalizeAchievementAdminMongooseDoc } from "@/lib/achievement-admin-normalize";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    let body: { reviewNote?: string } = {};
    try {
      body = (await request.json()) as { reviewNote?: string };
    } catch {
      body = {};
    }

    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const idStr = doc._id?.toString();
    const snap = () => ({
      id: idStr,
      resultType: doc.get("resultType"),
      medalType: doc.get("medalType"),
      rank: doc.get("rank"),
      participationType: doc.get("participationType"),
      teamRole: doc.get("teamRole"),
    });

    console.info("[approve:before-normalize]", snap());
    normalizeAchievementAdminMongooseDoc(doc);
    console.info("[approve:after-normalize]", snap());

    const now = new Date();
    applyAchievementPlatformApproval(doc, gate, now, body, "fromRole");

    console.info("[approve:before-save]", snap());
    await doc.save();

    try {
      await tryIssueCertificateForAchievementDoc(doc, {
        role: issuerKindFromReviewerRole(String(gate.user.role || "")),
        userId: gate.user._id as mongoose.Types.ObjectId,
      });
    } catch (issueErr) {
      console.error("[approve certificate issue]", issueErr);
    }

    try {
      const uid = doc.userId as mongoose.Types.ObjectId;
      const displayTitle = achievementDisplayTitle(doc);
      await createStudentNotification({
        userId: uid,
        type: "achievement_approved",
        title: "تم اعتماد إنجازك",
        message: `تم اعتماد الإنجاز «${displayTitle}». تُصدر شهادة الشكر تلقائيًا بمجرد أول اعتماد من إحدى الجهات المخولة (الإدارة، مدير المدرسة، رائد النشاط، أو المحكم).`,
        relatedAchievementId: doc._id,
      });
    } catch (notifyErr) {
      console.error("[approve notifications]", notifyErr);
    }

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      status: doc.status,
      approvalStatus: doc.isFeatured ? "featured" : "approved",
      certificateId: doc.certificateId,
      certificateVerificationToken: doc.certificateVerificationToken,
      certificateIssued: doc.certificateIssued === true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH approve]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

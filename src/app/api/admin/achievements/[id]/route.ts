import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";
import { inferAchievementField } from "@/lib/achievement-field-inference";
import { clampInferredFieldToAllowlist } from "@/lib/achievement-inferred-field-allowlist";
import { calculateAchievementScore } from "@/lib/achievement-scoring";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const ADMIN_EDITABLE_STRING_KEYS = [
  "nameAr",
  "nameEn",
  "description",
  "achievementLevel",
  "achievementType",
  "achievementCategory",
  "achievementClassification",
  "organization",
  "competitionName",
  "customCompetitionName",
  "programName",
  "customProgramName",
  "exhibitionName",
  "customExhibitionName",
  "resultType",
  "medalType",
  "rank",
  "resultValue",
  "participationType",
  "achievementName",
  "customAchievementName",
  "nominationText",
  "specialAwardText",
  "recognitionText",
  "otherResultText",
  "teamRole",
  "olympiadField",
  "olympiadMeeting",
  "evidenceUrl",
  "evidenceFileName",
] as const;

/** Admin-only: update achievement record fields (audit: lastEditedByRole = admin). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (String(gate.user.role || "") !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await connectDB();
    const existing = await Achievement.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const ex = existing.toObject() as unknown as Record<string, unknown>;
    const $set: Record<string, unknown> = {
      lastEditedByRole: "admin",
      updatedAt: new Date(),
    };

    for (const key of ADMIN_EDITABLE_STRING_KEYS) {
      if (key in body && body[key] !== undefined) {
        const v = body[key];
        $set[key] = typeof v === "string" ? v.trim() : v === null ? "" : String(v ?? "").trim();
      }
    }

    if (typeof body.achievementYear === "number" && Number.isFinite(body.achievementYear)) {
      $set.achievementYear = body.achievementYear;
    } else if (body.achievementYear !== undefined && body.achievementYear !== null) {
      const y = Number(body.achievementYear);
      if (Number.isFinite(y)) $set.achievementYear = y;
    }

    const dateStr = typeof body.achievementDate === "string" ? body.achievementDate.trim().slice(0, 10) : "";
    if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      $set.date = new Date(dateStr);
      const y = parseInt(dateStr.slice(0, 4), 10);
      if (Number.isFinite(y)) $set.achievementYear = y;
    }

    const inferredOverride = clampInferredFieldToAllowlist(body.inferredField);
    const mergedType = String($set.achievementType ?? ex.achievementType ?? "");
    const mergedName =
      String($set.achievementName ?? ex.achievementName ?? ex.title ?? "").trim() ||
      String(ex.nameAr || ex.nameEn || "");
    const mergedDesc = String($set.description ?? ex.description ?? "");
    const mergedOlympiadField = String($set.olympiadField ?? ex.olympiadField ?? "");
    const mergedMawhibaSubject = String(
      (ex as { mawhibaAnnualSubject?: string }).mawhibaAnnualSubject ?? ""
    );
    const mergedCustomName = String($set.customAchievementName ?? ex.customAchievementName ?? "");

    const fieldInference = inferAchievementField(
      mergedType,
      mergedName,
      mergedOlympiadField,
      mergedMawhibaSubject,
      mergedCustomName || mergedDesc
    );
    const resolvedInferred = inferredOverride || fieldInference.field;
    $set.inferredField = resolvedInferred;
    $set.domain = resolvedInferred;

    const achievementLevel = String($set.achievementLevel ?? ex.achievementLevel ?? "");
    const resultType = String($set.resultType ?? ex.resultType ?? "");
    const participationType = String($set.participationType ?? ex.participationType ?? "individual");
    const evidenceRequiredMode =
      (ex.evidenceRequiredMode as string) === "skipped" ? "skipped" : "provided";
    const requiresCommitteeReview = evidenceRequiredMode === "skipped";

    const scoreResult = calculateAchievementScore({
      achievementType: mergedType,
      achievementLevel,
      resultType,
      achievementName: mergedName,
      medalType: String($set.medalType ?? ex.medalType ?? "") || undefined,
      rank: String($set.rank ?? ex.rank ?? "") || undefined,
      participationType,
      requiresCommitteeReview,
    });
    $set.score = scoreResult.score;
    $set.scoreBreakdown = scoreResult.scoreBreakdown;
    $set.level = achievementLevel;

    const finalTitle =
      String($set.nameAr || ex.nameAr || "").trim() ||
      String($set.nameEn || ex.nameEn || "").trim() ||
      mergedName;
    if (finalTitle) $set.title = finalTitle;

    const updated = await Achievement.findByIdAndUpdate(id, { $set }, { new: true }).lean();

    return NextResponse.json({
      success: true,
      achievement: updated,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH admin achievement]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

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
      if (!doc.userId) {
        // External / snapshot achievements — no student account to notify
      } else {
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
      }
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

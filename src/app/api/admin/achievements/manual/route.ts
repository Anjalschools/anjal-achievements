import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAchievementReviewer } from "@/lib/review-auth";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import {
  normalizeAchievementPayload,
  validateNormalizedPayload,
} from "@/lib/achievement-payload-normalize";
import { OLYMPIAD_EVENT_OTHER_VALUE } from "@/constants/achievement-ui-categories";
import { inferAchievementField } from "@/lib/achievement-field-inference";
import { calculateAchievementScore } from "@/lib/achievement-scoring";
import { clampInferredFieldToAllowlist } from "@/lib/achievement-inferred-field-allowlist";
import {
  hasStudentAchievementDuplicate,
  normalizeAchievementNameForDuplicateKey,
  resolveComparableAchievementNameForDuplicate,
  resolveAchievementComparableYearFromPayload,
} from "@/lib/achievement-duplicate";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { normalizeAttachmentsArray } from "@/lib/achievement-attachments";
import { applyAiReviewToDoc, runAchievementAiReview } from "@/lib/achievement-ai-review";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const body = (await request.json()) as Record<string, unknown>;
    const inputMode = String(body.inputMode || "linked").trim() === "external" ? "external" : "linked";
    const adminStatus = String(body.adminStatus || "pending_review").trim();

    let targetUserId: mongoose.Types.ObjectId | null = null;
    let studentSourceType: "linked_user" | "external_student" | "alumni_student" = "linked_user";
    let studentProfileKey: mongoose.Types.ObjectId | undefined;
    let studentSnapshot: Record<string, unknown> | undefined;

    if (inputMode === "linked") {
      const lid = String(body.linkedUserId || "").trim();
      if (!lid) {
        return NextResponse.json(
          { error: "يجب اختيار الطالب المسجل قبل الحفظ" },
          { status: 400 }
        );
      }
      if (!mongoose.Types.ObjectId.isValid(lid)) {
        return NextResponse.json({ error: "معرّف الطالب غير صالح" }, { status: 400 });
      }
      const u = await User.findOne({
        _id: new mongoose.Types.ObjectId(lid),
        role: "student",
        status: "active",
      }).select("_id");
      if (!u) {
        return NextResponse.json({ error: "الطالب غير موجود أو غير نشط" }, { status: 404 });
      }
      targetUserId = u._id as mongoose.Types.ObjectId;
    } else {
      studentSourceType =
        String(body.externalStudentKind || "external_student").trim() === "alumni_student"
          ? "alumni_student"
          : "external_student";
      studentProfileKey = new mongoose.Types.ObjectId();
      studentSnapshot = {
        fullNameAr: String(body.snapshotFullNameAr || "").trim(),
        fullNameEn: String(body.snapshotFullNameEn || "").trim() || undefined,
        gender: body.snapshotGender === "female" ? "female" : "male",
        grade: String(body.snapshotGrade || "").trim(),
        section: String(body.snapshotSection || "").trim(),
        track: String(body.snapshotTrack || "").trim(),
        stage: String(body.snapshotStage || "").trim(),
        status:
          body.snapshotStudentStatus === "alumni"
            ? "alumni"
            : body.snapshotStudentStatus === "external"
              ? "external"
              : "current",
      };
      if (!studentSnapshot.fullNameAr && !studentSnapshot.fullNameEn) {
        return NextResponse.json({ error: "اسم الطالب مطلوب في السجل الخارجي" }, { status: 400 });
      }
    }

    console.info("[admin/achievements/manual]", {
      inputMode,
      flow: inputMode === "linked" ? "linked" : "manual_external",
      hasTargetUserId: Boolean(targetUserId),
    });

    const merged: Record<string, unknown> = {
      ...body,
      evidenceRequiredMode: body.evidenceRequiredMode === "skipped" ? "skipped" : "provided",
      requiresCommitteeReview: body.requiresCommitteeReview === true,
    };

    const normalized = normalizeAchievementPayload(merged);

    const finalAchievementName =
      normalized.achievementName === "other"
        ? normalized.customAchievementName || "other"
        : normalized.achievementName === OLYMPIAD_EVENT_OTHER_VALUE
          ? (normalized.customAchievementName?.trim() || normalized.achievementName)
          : normalized.achievementName || normalized.customAchievementName || "Achievement";

    if (inputMode === "linked" && targetUserId) {
      const comparableForDup = resolveComparableAchievementNameForDuplicate({
        achievementName: normalized.achievementName,
        customAchievementName: normalized.customAchievementName,
      });
      const dupNameKey = normalizeAchievementNameForDuplicateKey(comparableForDup);
      const dupComparableYear = resolveAchievementComparableYearFromPayload({
        achievementDate: normalized.achievementDate,
        achievementYear: normalized.achievementYear,
      });
      if (
        dupNameKey &&
        (await hasStudentAchievementDuplicate({
          userId: targetUserId,
          nameKeyNormalized: dupNameKey,
          comparableYear: dupComparableYear,
        }))
      ) {
        return NextResponse.json({ error: "إنجاز مكرر لنفس الطالب في نفس الفترة" }, { status: 409 });
      }
    }

    const fieldInference = inferAchievementField(
      normalized.achievementType,
      finalAchievementName,
      normalized.olympiadField,
      normalized.mawhibaAnnualSubject,
      normalized.customAchievementName || normalized.description || ""
    );
    const inferredFieldOverride = clampInferredFieldToAllowlist(body.inferredField);
    const resolvedInferredField = inferredFieldOverride || fieldInference.field;

    const validationErrors = validateNormalizedPayload(normalized);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors: validationErrors }, { status: 400 });
    }

    const scoreResult = calculateAchievementScore({
      achievementType: normalized.achievementType,
      achievementLevel: normalized.achievementLevel,
      resultType: normalized.resultType,
      achievementName: finalAchievementName,
      medalType: normalized.medalType,
      rank: normalized.rank,
      participationType: normalized.participationType,
      requiresCommitteeReview: normalized.requiresCommitteeReview,
    });

    if (!scoreResult.isEligible) {
      return NextResponse.json(
        { error: "Score calculation failed", errors: scoreResult.validationErrors },
        { status: 400 }
      );
    }

    let status: "pending" | "pending_review" | "needs_revision" | "approved" | "rejected" = "pending_review";
    let isFeatured = false;
    if (adminStatus === "approved") {
      status = "approved";
    } else if (adminStatus === "featured") {
      status = "approved";
      isFeatured = true;
    } else if (adminStatus === "needs_revision") {
      status = "needs_revision";
    } else if (adminStatus === "rejected") {
      status = "rejected";
    } else {
      status = "pending_review";
    }

    const now = new Date();
    const adminId = gate.user._id as mongoose.Types.ObjectId;

    const attachments = body.attachments ? normalizeAttachmentsArray(body.attachments) : undefined;

    const achievementData: Record<string, unknown> = {
      achievementType: normalized.achievementType,
      achievementCategory: ["competition", "program", "exhibition"].includes(
        String(normalized.achievementCategory || "")
      )
        ? normalized.achievementCategory
        : undefined,
      achievementLevel: normalized.achievementLevel,
      participationType: normalized.participationType,
      resultType: normalized.resultType,
      inferredField: resolvedInferredField,
      score: scoreResult.score,
      scoreBreakdown: scoreResult.scoreBreakdown,
      achievementYear: normalized.achievementYear,
      status,
      isFeatured,
      featured: isFeatured,
      approved: status === "approved",
      evidenceRequiredMode: normalized.evidenceRequiredMode,
      verificationStatus: normalized.verificationStatus,
      verificationSummary: normalized.verificationSummary,
      evidenceExtractedData: normalized.evidenceExtractedData,
      evidenceMatchStatus: normalized.evidenceMatchStatus,
      requiresCommitteeReview: normalized.requiresCommitteeReview,
      achievementName: finalAchievementName,
      nameAr: normalized.nameAr || finalAchievementName,
      nameEn: normalized.nameEn || finalAchievementName,
      submittedByRole: "admin",
      submittedByAdminId: adminId,
      showInHallOfFame: body.showInHallOfFame !== false,
      publicPortfolioSuppressedByAdmin: body.showInPublicPortfolio === false,
      showInPublicPortfolio: body.showInPublicPortfolio !== false,
    };

    if (inputMode === "linked" && targetUserId) {
      achievementData.userId = targetUserId;
      achievementData.studentSourceType = "linked_user";
    } else {
      achievementData.studentSourceType = studentSourceType;
      achievementData.studentProfileKey = studentProfileKey;
      achievementData.studentSnapshot = studentSnapshot;
    }

    if (normalized.customAchievementName) achievementData.customAchievementName = normalized.customAchievementName;
    if (normalized.medalType) achievementData.medalType = normalized.medalType;
    if (normalized.rank) achievementData.rank = normalized.rank;
    if (normalized.nominationText) achievementData.nominationText = normalized.nominationText;
    if (normalized.specialAwardText) achievementData.specialAwardText = normalized.specialAwardText;
    if (normalized.recognitionText) achievementData.recognitionText = normalized.recognitionText;
    if (normalized.otherResultText) achievementData.otherResultText = normalized.otherResultText;
    if (normalized.participationType === "team" && normalized.teamRole) achievementData.teamRole = normalized.teamRole;
    if (typeof body.programName === "string") achievementData.programName = body.programName;
    if (typeof body.customProgramName === "string") achievementData.customProgramName = body.customProgramName;
    if (typeof body.competitionName === "string") achievementData.competitionName = body.competitionName;
    if (typeof body.customCompetitionName === "string") {
      achievementData.customCompetitionName = body.customCompetitionName;
    }
    if (typeof body.exhibitionName === "string") achievementData.exhibitionName = body.exhibitionName;
    if (typeof body.customExhibitionName === "string") {
      achievementData.customExhibitionName = body.customExhibitionName;
    }
    if (typeof body.olympiadMeeting === "string") achievementData.olympiadMeeting = body.olympiadMeeting;
    if (typeof body.organization === "string") achievementData.organization = body.organization;
    if (typeof body.excellenceProgramName === "string") {
      achievementData.excellenceProgramName = body.excellenceProgramName;
    }
    if (typeof body.customExcellenceProgramName === "string") {
      achievementData.customExcellenceProgramName = body.customExcellenceProgramName;
    }
    if (typeof body.qudratScore === "string") achievementData.qudratScore = body.qudratScore;
    if (typeof body.mawhibaAnnualRank === "string") achievementData.mawhibaAnnualRank = body.mawhibaAnnualRank;
    if (normalized.olympiadField) achievementData.olympiadField = normalized.olympiadField;
    if (normalized.mawhibaAnnualSubject) achievementData.mawhibaAnnualSubject = normalized.mawhibaAnnualSubject;
    if (typeof normalized.giftedDiscoveryScore === "number") {
      achievementData.giftedDiscoveryScore = normalized.giftedDiscoveryScore;
    }
    if (normalized.description) achievementData.description = normalized.description;
    if (typeof body.image === "string") achievementData.image = body.image;
    if (attachments) achievementData.attachments = attachments;
    if (typeof body.certificateNumber === "string" && body.certificateNumber.trim()) {
      achievementData.certificateNumber = body.certificateNumber.trim();
    }
    if (normalized.evidenceUrl) achievementData.evidenceUrl = normalized.evidenceUrl;
    if (normalized.evidenceFileName) achievementData.evidenceFileName = normalized.evidenceFileName;
    if (typeof body.adminWorkflowNote === "string") achievementData.adminWorkflowNote = String(body.adminWorkflowNote).slice(0, 4000);

    const dateStr =
      normalized.achievementDate && /^\d{4}-\d{2}-\d{2}/.test(normalized.achievementDate)
        ? normalized.achievementDate
        : null;
    achievementData.date = dateStr ? new Date(dateStr) : new Date(`${normalized.achievementYear}-01-01`);
    achievementData.title = finalAchievementName;
    achievementData.domain = resolvedInferredField;
    achievementData.level = normalized.achievementLevel;
    if (normalized.achievementClassification) {
      achievementData.achievementClassification = normalized.achievementClassification;
    }

    if (status === "approved") {
      achievementData.reviewedAt = now;
      achievementData.reviewedBy = adminId;
      achievementData.adminApprovedAt = now;
      achievementData.adminApprovedBy = adminId;
    }
    if (body.certificateIssued === true) {
      achievementData.certificateIssued = true;
      achievementData.certificateIssuedAt = now;
    }

    const created = await Achievement.create(achievementData);

    if (status === "pending_review" && targetUserId) {
      try {
        const ai = await runAchievementAiReview({
          userId: String(targetUserId),
          achievementId: String(created._id),
          achievementYear: normalized.achievementYear,
          achievementName: finalAchievementName,
          achievementLevel: normalized.achievementLevel,
          achievementType: normalized.achievementType,
          resultType: normalized.resultType,
          locale: "ar",
        });
        applyAiReviewToDoc(created, ai);
        await created.save();
      } catch (aiErr) {
        console.error("[manual achievement AI review]", aiErr);
      }
    }

    await logAuditEvent({
      actionType: "achievement_created",
      entityType: "achievement",
      entityId: String(created._id),
      entityTitle: finalAchievementName,
      descriptionAr: `إنشاء إنجاز إداري بحالة ${adminStatus}`,
      metadata: { inputMode, adminStatus },
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({
      ok: true,
      id: String(created._id),
      message: "تم حفظ الإنجاز",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/admin/achievements/manual]", e);
    return NextResponse.json({ error: msg || "Internal server error" }, { status: 500 });
  }
}

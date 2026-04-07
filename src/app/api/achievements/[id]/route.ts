import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { OLYMPIAD_EVENT_OTHER_VALUE } from "@/constants/achievement-ui-categories";
import { QUDRAT_TIER_ALLOWED_VALUES } from "@/constants/achievement-options";
import { normalizeLegacyQudratAchievementName } from "@/lib/achievementNormalize";
import { inferAchievementField } from "@/lib/achievement-field-inference";
import { clampInferredFieldToAllowlist } from "@/lib/achievement-inferred-field-allowlist";
import {
  resolveAchievementComparableYearFromPayload,
  DUPLICATE_ACHIEVEMENT_RESPONSE,
  hasStudentAchievementDuplicate,
  normalizeAchievementNameForDuplicateKey,
  resolveComparableAchievementNameForDuplicate,
} from "@/lib/achievement-duplicate";
import { calculateAchievementScore } from "@/lib/achievement-scoring";
import { getScoringConfig } from "@/lib/getScoringConfig";
import { isStudentDeleteLocked, isStudentEditLocked } from "@/lib/achievementWorkflow";
import {
  diffSnapshotChangedKeys,
  pickApprovedSnapshot,
  type ApprovedSnapshot,
} from "@/lib/achievement-snapshot";
import { notifyReviewersAchievementUpdatedForReview } from "@/lib/reviewer-notifications";
import { buildStudentAchievementDetailPayload } from "@/lib/achievement-detail-response";
import { normalizeAttachmentsArray } from "@/lib/achievement-attachments";
import { mergeResubmitWorkflowState } from "@/lib/achievement-workflow-state";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { queueHomeStatsRefresh } from "@/lib/home-stats-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { scheduleAchievementAttachmentAiReviewAfterMutation } from "@/lib/achievement-attachment-ai-review-runner";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: { id: string };
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    perfLog("page:achievementDetails:start");
    await connectDB();

    if (!params.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
    }

    const tAuth = perfNow();
    const currentUser = await getCurrentDbUser();
    perfElapsed("page:achievementDetails:getCurrentDbUser", tAuth);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    const tDoc = perfNow();
    const achievement = await Achievement.findOne({ _id: params.id, userId: currentUser._id }).lean();
    perfElapsed("page:achievementDetails:achievementQuery", tDoc);
    if (!achievement) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    return NextResponse.json(buildStudentAchievementDetailPayload(achievement));
  } catch (error) {
    console.error("Error fetching achievement details:", error);
    return jsonInternalServerError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    if (!params.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
    }

    const currentUser = await getCurrentDbUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    const existing = await Achievement.findOne({ _id: params.id, userId: currentUser._id });
    if (!existing) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const existingPlain = existing.toObject() as unknown as Record<string, unknown>;
    if (isStudentEditLocked(existingPlain as Record<string, unknown>)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message:
            "This achievement is approved and locked. Contact support if you need changes.",
        },
        { status: 403 }
      );
    }

    const wasPendingReReview = existing.pendingReReview === true;
    const wasApprovedFlow =
      String(existing.status ?? "") === "approved" || existing.approved === true;
    const fromNeedsRevision = String(existing.status ?? "") === "needs_revision";

    const body = (await request.json()) as Record<string, unknown>;
    const hasOwn = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    const achievementType = String(body.achievementType || existing.achievementType || "");
    let achievementLevel = String(body.achievementLevel || existing.achievementLevel || "");
    const participationType = String(body.participationType || existing.participationType || "individual");
    let resultType = String(body.resultType || existing.resultType || "");
    let achievementName = String(body.achievementName || existing.achievementName || "").trim();
    const customAchievementName = String(body.customAchievementName || existing.customAchievementName || "").trim();

    if (achievementType === "gifted_discovery") {
      achievementName = "exceptional_gifted";
      resultType = "participation";
    }
    if (achievementType === "mawhiba_annual") {
      resultType = "rank";
    }
    if (achievementType === "qudrat") {
      achievementName = normalizeLegacyQudratAchievementName(achievementName);
      achievementLevel = "kingdom";
      resultType = "participation";
    }
    if (achievementType === "sat" || achievementType === "ielts" || achievementType === "toefl") {
      achievementLevel = "international";
      resultType = "score";
      if (!String(achievementName || "").trim()) {
        achievementName = achievementType;
      }
    }

    if (achievementType === "gifted_discovery") {
      const gs = hasOwn("giftedDiscoveryScore")
        ? body.giftedDiscoveryScore
        : (existing as { giftedDiscoveryScore?: number }).giftedDiscoveryScore;
      const n = typeof gs === "number" ? gs : Number(gs);
      if (!Number.isFinite(n) || n <= 1600) {
        return NextResponse.json(
          {
            error: "Validation failed",
            errors: ["Gifted discovery score must be greater than 1600"],
          },
          { status: 400 }
        );
      }
    }

    if (
      achievementType === "qudrat" &&
      !(QUDRAT_TIER_ALLOWED_VALUES as readonly string[]).includes(achievementName)
    ) {
      return NextResponse.json(
        { error: "Validation failed", errors: ["Invalid Qudrat percent tier"] },
        { status: 400 }
      );
    }

    if (
      (achievementType === "sat" ||
        achievementType === "ielts" ||
        achievementType === "toefl") &&
      !String(body.resultValue ?? (existing as { resultValue?: string }).resultValue ?? "").trim()
    ) {
      return NextResponse.json(
        { error: "Validation failed", errors: ["Test score is required"] },
        { status: 400 }
      );
    }

    const finalName =
      achievementName === "other"
        ? customAchievementName || "other"
        : achievementName === OLYMPIAD_EVENT_OTHER_VALUE
          ? (customAchievementName || achievementName)
          : achievementName || customAchievementName || "Achievement";
    const existingNameKey = String(existing.achievementName || "").trim();
    const didChangeNameKey =
      typeof body.achievementName === "string" && String(body.achievementName || "").trim() !== existingNameKey;
    // CRITICAL: if the name key changed, refresh nameAr/nameEn too so UI doesn't keep showing the old hydrated title.
    const nameArRaw = hasOwn("nameAr") ? String(body.nameAr || "").trim() : "";
    const nameEnRaw = hasOwn("nameEn") ? String(body.nameEn || "").trim() : "";
    const nameAr = hasOwn("nameAr")
      ? (nameArRaw || finalName)
      : didChangeNameKey
        ? finalName
        : String(existing.nameAr || "").trim() || finalName;
    const nameEn = hasOwn("nameEn")
      ? (nameEnRaw || finalName)
      : didChangeNameKey
        ? finalName
        : String(existing.nameEn || "").trim() || finalName;
    const achievementCategory = String(
      body.achievementCategory || existing.achievementCategory || achievementType || "competition"
    ).trim();

    const evidenceRequiredMode: "provided" | "skipped" =
      body.evidenceRequiredMode === "skipped" ? "skipped" : "provided";
    const evidenceUrl = String(body.evidenceUrl || existing.evidenceUrl || "").trim();
    const evidenceFileName = String(body.evidenceFileName || existing.evidenceFileName || "").trim();
    const image = String(body.image || existing.image || "").trim();
    const attachments = Array.isArray(body.attachments)
      ? normalizeAttachmentsArray(body.attachments)
      : normalizeAttachmentsArray(existing.attachments || []);
    const hasEvidence = Boolean(evidenceUrl || evidenceFileName || image || attachments.length > 0);
    const requiresCommitteeReview = evidenceRequiredMode === "skipped";

    if (evidenceRequiredMode !== "skipped" && !hasEvidence) {
      return NextResponse.json(
        { error: "Validation failed", errors: ["Evidence is required: provide file/link or choose committee review"] },
        { status: 400 }
      );
    }

    const achievementYearNext =
      typeof body.achievementYear === "number"
        ? body.achievementYear
        : Number(body.achievementYear) || existing.achievementYear || new Date().getFullYear();
    const rawAchievementDate = String(body.achievementDate || "").trim().slice(0, 10);
    const dupComparableYear = resolveAchievementComparableYearFromPayload({
      achievementDate: rawAchievementDate || undefined,
      achievementYear: achievementYearNext,
    });
    const dupNameKey = normalizeAchievementNameForDuplicateKey(
      resolveComparableAchievementNameForDuplicate({
        achievementName,
        customAchievementName,
      })
    );
    if (
      dupNameKey &&
      (await hasStudentAchievementDuplicate({
        userId: currentUser._id as mongoose.Types.ObjectId,
        nameKeyNormalized: dupNameKey,
        comparableYear: dupComparableYear,
        excludeAchievementId: new mongoose.Types.ObjectId(params.id),
      }))
    ) {
      return NextResponse.json(
        { ok: false, ...DUPLICATE_ACHIEVEMENT_RESPONSE },
        { status: 409 }
      );
    }

    const fieldInference = inferAchievementField(
      achievementType,
      finalName,
      String(body.olympiadField || existing.olympiadField || ""),
      String(body.mawhibaAnnualSubject || existing.mawhibaAnnualSubject || ""),
      customAchievementName || String(body.description || existing.description || "")
    );
    const inferredFieldOverride = clampInferredFieldToAllowlist(body.inferredField);
    const resolvedInferredField = inferredFieldOverride || fieldInference.field;

    const scoringConfig = await getScoringConfig();
    const scoreResult = calculateAchievementScore({
      achievementType,
      achievementLevel,
      resultType,
      achievementName: finalName,
      medalType: String(body.medalType || existing.medalType || "") || undefined,
      rank: String(body.rank || existing.rank || "") || undefined,
      participationType,
      requiresCommitteeReview,
      scoringConfig,
    });

    const now = new Date();
    const nextEditVersion =
      (typeof existing.editVersion === "number" && Number.isFinite(existing.editVersion)
        ? existing.editVersion
        : 0) + 1;

    const updateData: Record<string, unknown> = {
      achievementType,
      achievementCategory,
      achievementName: finalName,
      nameAr,
      nameEn,
      customAchievementName: customAchievementName || undefined,
      achievementLevel,
      participationType,
      teamRole: participationType === "team" ? String(body.teamRole || existing.teamRole || "").trim() || undefined : undefined,
      resultType,
      resultValue: String(body.resultValue || existing.resultValue || "").trim() || undefined,
      medalType: String(body.medalType || existing.medalType || "").trim() || undefined,
      rank: String(body.rank || existing.rank || "").trim() || undefined,
      nominationText: String(body.nominationText || existing.nominationText || "").trim() || undefined,
      specialAwardText: String(body.specialAwardText || existing.specialAwardText || "").trim() || undefined,
      recognitionText: String(body.recognitionText || existing.recognitionText || "").trim() || undefined,
      otherResultText: String(body.otherResultText || existing.otherResultText || "").trim() || undefined,
      inferredField: resolvedInferredField,
      score: scoreResult.score,
      scoreBreakdown: scoreResult.scoreBreakdown,
      achievementYear: achievementYearNext,
      description: String(body.description || existing.description || "").trim() || undefined,
      image: image || undefined,
      attachments,
      evidenceUrl: evidenceUrl || undefined,
      evidenceFileName: evidenceFileName || undefined,
      evidenceRequiredMode,
      verificationStatus: requiresCommitteeReview ? "pending_committee_review" : "unverified",
      verificationSummary: requiresCommitteeReview
        ? "Evidence skipped by student. Requires committee review."
        : hasEvidence
          ? "Initial evidence metadata captured."
          : "No evidence metadata.",
      evidenceExtractedData: {
        evidenceUrl: evidenceUrl || null,
        evidenceFileName: evidenceFileName || null,
        hasImage: Boolean(image),
        attachmentsCount: attachments.length,
      },
      evidenceMatchStatus: "unknown",
      requiresCommitteeReview,
      // backward compatibility mirrors
      title: finalName,
      domain: resolvedInferredField,
      level: achievementLevel,
      date:
        rawAchievementDate && /^\d{4}-\d{2}-\d{2}/.test(rawAchievementDate)
          ? new Date(rawAchievementDate)
          : new Date(`${achievementYearNext}-01-01`),
    };

    if (fromNeedsRevision) {
      updateData.status = "pending_review";
      updateData.workflowState = mergeResubmitWorkflowState(existingPlain.workflowState, {
        fromNeedsRevision: true,
        lastAction: "saved_after_revision",
      });
    } else if (String(existing.status || "") === "pending") {
      // When record was returned to pending (e.g. after unapprove), student edits should re-enter pending_review.
      updateData.status = "pending_review";
    }

    let pendingReReview = wasPendingReReview;
    let previousApprovedSnapshot: ApprovedSnapshot | undefined =
      (existing.previousApprovedSnapshot as ApprovedSnapshot | undefined) || undefined;
    let enteredReReview = false;

    if (wasApprovedFlow && !wasPendingReReview) {
      pendingReReview = true;
      previousApprovedSnapshot = pickApprovedSnapshot(existingPlain);
      enteredReReview = true;
    }

    const mergedForDiff: Record<string, unknown> = {
      ...existingPlain,
      ...updateData,
      pendingReReview,
      lastStudentEditAt: now,
      lastEditedByRole: "student",
      editVersion: nextEditVersion,
    };
    if (previousApprovedSnapshot) {
      mergedForDiff.previousApprovedSnapshot = previousApprovedSnapshot;
    }

    const changedFields: string[] =
      pendingReReview && previousApprovedSnapshot && Object.keys(previousApprovedSnapshot).length > 0
        ? diffSnapshotChangedKeys(previousApprovedSnapshot, pickApprovedSnapshot(mergedForDiff))
        : [];

    const workflowExtra: Record<string, unknown> = {
      pendingReReview,
      lastStudentEditAt: now,
      lastEditedByRole: "student",
      editVersion: nextEditVersion,
      changedFields,
    };
    if (previousApprovedSnapshot && Object.keys(previousApprovedSnapshot).length > 0) {
      workflowExtra.previousApprovedSnapshot = previousApprovedSnapshot;
    }

    const mongoUpdate: mongoose.UpdateQuery<Record<string, unknown>> = {
      $set: { ...updateData, ...workflowExtra },
    };

    if (enteredReReview) {
      Object.assign(mongoUpdate.$set as Record<string, unknown>, {
        certificateRevokedAt: now,
        certificateIssued: false,
        certificateIssuedAt: undefined,
        certificateSnapshot: undefined,
        certificateApprovedByRole: undefined,
        certificateApprovedById: undefined,
        certificateApprovedAt: undefined,
        adminApprovedAt: undefined,
        adminApprovedBy: undefined,
        principalApprovedAt: undefined,
        principalApprovedBy: undefined,
        activitySupervisorApprovedAt: undefined,
        activitySupervisorApprovedBy: undefined,
        judgeApprovedAt: undefined,
        judgeApprovedBy: undefined,
      });
      mongoUpdate.$unset = { certificateVerificationToken: "" };
      const prevTok = String(existing.certificateVerificationToken || "").trim();
      if (prevTok) {
        mongoUpdate.$push = { certificateSupersededTokens: prevTok };
      }
    }

    const updated = await Achievement.findByIdAndUpdate(params.id, mongoUpdate, { new: true });
    if (!updated) {
      return jsonInternalServerError(null, { fallbackMessage: "Failed to update achievement" });
    }

    // Audit: student edits after unapprove (certificate revoked without re-approval yet).
    const revokedAt = existing.certificateRevokedAt instanceof Date ? existing.certificateRevokedAt : null;
    const editedAfterUnapprove =
      revokedAt instanceof Date &&
      String(existing.status || "") !== "approved" &&
      existing.approved !== true &&
      (existing.lastStudentEditAt ? existing.lastStudentEditAt < revokedAt : true);
    if (editedAfterUnapprove) {
      await logAuditEvent({
        actionType: "achievement_student_edited_after_unapprove",
        entityType: "achievement",
        entityId: updated._id.toString(),
        entityTitle: String(updated.nameAr || updated.nameEn || updated.achievementName || updated.title || "")
          .trim()
          .slice(0, 200) || undefined,
        descriptionAr: "قام الطالب بتعديل إنجاز بعد إلغاء اعتماده (قبل إعادة الاعتماد).",
        actor: actorFromUser(currentUser as any),
        before: {
          status: existing.status,
          approved: existing.approved,
          certificateRevokedAt: existing.certificateRevokedAt,
          nameAr: existing.nameAr,
          nameEn: existing.nameEn,
          achievementName: existing.achievementName,
        },
        after: {
          status: updated.status,
          approved: updated.approved,
          lastStudentEditAt: (updated as any).lastStudentEditAt,
          editVersion: (updated as any).editVersion,
          changedFields: (updated as any).changedFields,
          nameAr: updated.nameAr,
          nameEn: updated.nameEn,
          achievementName: updated.achievementName,
        },
        outcome: "success",
        platform: "website",
      });
    }

    scheduleAchievementAttachmentAiReviewAfterMutation(String(updated._id), "achievement_update");

    if (enteredReReview && updated) {
      try {
        const studentName = String(currentUser.fullName || "").trim() || "طالب";
        const displayTitle =
          String(updated.nameAr || updated.nameEn || updated.achievementName || updated.title || "إنجاز").slice(
            0,
            200
          );
        await notifyReviewersAchievementUpdatedForReview({
          achievementId: updated._id,
          studentName,
          achievementTitle: displayTitle,
        });
      } catch (notifyErr) {
        console.error("[achievement re-review notify]", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      achievementId: updated._id.toString(),
      inferredField: updated.inferredField || resolvedInferredField,
      score: updated.score ?? scoreResult.score,
      scoreBreakdown: (updated as any).scoreBreakdown || scoreResult.scoreBreakdown,
      pendingReReview: (updated as any).pendingReReview === true,
      message: "Achievement updated successfully",
      title: String(updated.nameAr || updated.nameEn || updated.achievementName || updated.title || "").trim(),
    });
  } catch (error) {
    console.error("Error updating achievement:", error);
    return jsonInternalServerError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    if (!params.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
    }

    const currentUser = await getCurrentDbUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    const existingDel = await Achievement.findOne({ _id: params.id, userId: currentUser._id });
    if (!existingDel) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }
    if (isStudentDeleteLocked(existingDel as unknown as Record<string, unknown>)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Approved achievements cannot be deleted.",
        },
        { status: 403 }
      );
    }

    const deleted = await Achievement.findOneAndDelete({ _id: params.id, userId: currentUser._id });
    if (!deleted) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    queueHomeStatsRefresh();

    return NextResponse.json({ success: true, message: "Achievement deleted successfully" });
  } catch (error) {
    console.error("Error deleting achievement:", error);
    return jsonInternalServerError(error);
  }
}


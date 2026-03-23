import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { OLYMPIAD_EVENT_OTHER_VALUE } from "@/constants/achievement-ui-categories";
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
import {
  isStudentDeleteLocked,
  isStudentEditLocked,
  resolveWorkflowDisplayStatus,
} from "@/lib/achievementWorkflow";
import {
  diffSnapshotChangedKeys,
  pickApprovedSnapshot,
  type ApprovedSnapshot,
} from "@/lib/achievement-snapshot";
import { notifyReviewersAchievementUpdatedForReview } from "@/lib/reviewer-notifications";
import {
  canStudentViewCertificate,
  isAchievementCertificateEligible,
  isLegacyCertificateRecord,
  labelCertificateIssuerRole,
  resolveCertificateUiStatus,
} from "@/lib/certificate-eligibility";
import { normalizeAttachmentsArray, serializeAttachmentsForStudentApi } from "@/lib/achievement-attachments";
import { mergeResubmitWorkflowState } from "@/lib/achievement-workflow-state";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

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

    const achAny = achievement as unknown as Record<string, unknown>;
    const pendingReReview = achAny.pendingReReview === true;
    const reviewComments = Array.isArray(achAny.reviewComments)
      ? achAny.reviewComments
      : [];
    const verifyToken =
      typeof achAny.certificateVerificationToken === "string"
        ? achAny.certificateVerificationToken
        : "";
    const certificateIssued = achAny.certificateIssued === true;
    const certLike = achievement as unknown as Parameters<typeof canStudentViewCertificate>[0];
    const certificateAvailable = canStudentViewCertificate(certLike);
    const certificateEligible = isAchievementCertificateEligible(certLike);
    const certificateLegacy = isLegacyCertificateRecord(certLike);
    const certificateStatus = resolveCertificateUiStatus(certLike);
    const certificateIssuedAtIso =
      achAny.certificateIssuedAt instanceof Date
        ? achAny.certificateIssuedAt.toISOString()
        : achAny.certificateIssuedAt
          ? String(achAny.certificateIssuedAt)
          : null;
    const certificateApprovedByRole =
      typeof achAny.certificateApprovedByRole === "string" ? achAny.certificateApprovedByRole : null;
    const loc = "ar" as const;
    const certificateIssuerLabelAr = labelCertificateIssuerRole(certificateApprovedByRole, loc);
    const certificateIssuerLabelEn = labelCertificateIssuerRole(certificateApprovedByRole, "en");
    const editLocked = isStudentEditLocked(achAny);

    const safeDate =
      achievement.date instanceof Date
        ? achievement.date
        : achievement.createdAt instanceof Date
          ? achievement.createdAt
          : achievement.achievementYear
            ? new Date(`${achievement.achievementYear}-01-01`)
            : null;

    const safeName =
      achievement.nameAr ||
      achievement.nameEn ||
      achievement.achievementName ||
      achievement.title ||
      achievement.customAchievementName ||
      "Achievement";

    const normalizedLevel = achievement.achievementLevel || achievement.level || "";
    const safeField = achievement.inferredField || achievement.domain || "";
    const achievementAny = achievement as any;
    const approvalStatus =
      achievementAny.approvalStatus ||
      resolveWorkflowDisplayStatus({
        status: achievementAny.status,
        isFeatured: achievementAny.isFeatured,
        featured: achievement.featured,
        approved: achievement.approved,
        verificationStatus: achievement.verificationStatus,
        pendingReReview,
      });

    const ws = achAny.workflowState as { resubmittedByStudent?: boolean } | undefined;
    const resubmittedByStudent = ws?.resubmittedByStudent === true;
    const { attachments: attachmentUrls, attachmentItems } = serializeAttachmentsForStudentApi(
      achievement.attachments
    );

    return NextResponse.json({
      id: achievement._id.toString(),
      title: safeName,
      name: safeName,
      achievementName: safeName,
      nameAr: achievement.nameAr || safeName,
      nameEn: achievement.nameEn || safeName,
      achievementType: achievement.achievementType || "",
      achievementCategory: achievement.achievementCategory || achievement.achievementType || "competition",
      achievementLevel: normalizedLevel,
      level: normalizedLevel,
      resultType: achievement.resultType || "",
      medalType: achievement.medalType || "",
      rank: achievement.rank || "",
      resultValue:
        achievement.resultValue ||
        (achievement.medalType
          ? achievement.medalType
          : achievement.rank
            ? achievement.rank
            : achievement.resultType || ""),
      participationType: achievement.participationType || "",
      achievementClassification: (achievement as any).achievementClassification || "",
      attachments: attachmentUrls,
      attachmentItems,
      resubmittedByStudent,
      inferredField: safeField,
      domain: safeField,
      description: achievement.description || "",
      score: achievement.score || 0,
      verificationStatus: achievement.verificationStatus || "unverified",
      evidenceRequiredMode: achievement.evidenceRequiredMode || "provided",
      requiresCommitteeReview: achievement.requiresCommitteeReview || false,
      approvalStatus,
      status: achievementAny.status || (achievement.approved ? "approved" : "pending"),
      isFeatured: achievementAny.isFeatured === true || achievement.featured === true,
      featured: achievement.featured || false,
      approved: achievement.approved || false,
      image: achievement.image || null,
      evidenceUrl: achievement.evidenceUrl || "",
      evidenceFileName: achievement.evidenceFileName || "",
      date: safeDate ? safeDate.toISOString().split("T")[0] : "",
      year: achievement.achievementYear || (safeDate ? safeDate.getFullYear() : null),
      createdAt: achievement.createdAt,
      updatedAt: achievement.updatedAt,
      reviewNote: achievementAny.reviewNote || "",
      reviewComments,
      aiReviewStatus: achievementAny.aiReviewStatus,
      aiFlags: achievementAny.aiFlags,
      aiSummary: achievementAny.aiSummary,
      aiConfidence: achievementAny.aiConfidence,
      aiSuggestedAction: achievementAny.aiSuggestedAction,
      certificateIssued,
      certificateId: achievementAny.certificateId || null,
      certificateVerificationUrl: verifyToken ? `/verify/certificate/${verifyToken}` : null,
      certificateAvailable,
      certificateEligible,
      certificateLegacy,
      certificateStatus,
      certificateIssuedAt: certificateIssuedAtIso,
      certificateApprovedByRole,
      certificateIssuerLabelAr,
      certificateIssuerLabelEn,
      principalApprovedAt: achAny.principalApprovedAt || null,
      activitySupervisorApprovedAt: achAny.activitySupervisorApprovedAt || null,
      adminApprovedAt: achAny.adminApprovedAt || null,
      judgeApprovedAt: achAny.judgeApprovedAt || null,
      certificateApprovedAt: achAny.certificateApprovedAt || null,
      certificateRevokedAt: achAny.certificateRevokedAt || null,
      editLocked,
      pendingReReview,
      lastStudentEditAt: achAny.lastStudentEditAt || null,
      lastEditedByRole: achAny.lastEditedByRole || null,
      changedFields: Array.isArray(achAny.changedFields) ? achAny.changedFields : [],
      previousApprovedSnapshot: achAny.previousApprovedSnapshot || null,
      organization: achievement.organization || "",
      programName: achievement.programName || "",
      customProgramName: achievement.customProgramName || "",
      competitionName: achievement.competitionName || "",
      customCompetitionName: achievement.customCompetitionName || "",
      exhibitionName: achievement.exhibitionName || "",
      customExhibitionName: achievement.customExhibitionName || "",
      olympiadMeeting: achievement.olympiadMeeting || "",
      customAchievementName: achievement.customAchievementName || "",
    });
  } catch (error) {
    console.error("Error fetching achievement details:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      achievementLevel = "kingdom";
      resultType = "participation";
    }

    const finalName =
      achievementName === "other"
        ? customAchievementName || "other"
        : achievementName === OLYMPIAD_EVENT_OTHER_VALUE
          ? (customAchievementName || achievementName)
          : achievementName || customAchievementName || "Achievement";
    const nameAr = String(body.nameAr || existing.nameAr || "").trim() || finalName;
    const nameEn = String(body.nameEn || existing.nameEn || "").trim() || finalName;
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

    const scoreResult = calculateAchievementScore({
      achievementType,
      achievementLevel,
      resultType,
      achievementName: finalName,
      medalType: String(body.medalType || existing.medalType || "") || undefined,
      rank: String(body.rank || existing.rank || "") || undefined,
      participationType,
      requiresCommitteeReview,
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
      achievementId: updated?._id?.toString?.() || params.id,
      inferredField: updated?.inferredField || resolvedInferredField,
      score: updated?.score ?? scoreResult.score,
      scoreBreakdown: updated?.scoreBreakdown || scoreResult.scoreBreakdown,
      pendingReReview: updated?.pendingReReview === true,
      message: "Achievement updated successfully",
    });
  } catch (error) {
    console.error("Error updating achievement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    return NextResponse.json({ success: true, message: "Achievement deleted successfully" });
  } catch (error) {
    console.error("Error deleting achievement:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


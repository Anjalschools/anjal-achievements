import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { OLYMPIAD_EVENT_OTHER_VALUE } from "@/constants/achievement-ui-categories";
import { inferAchievementField } from "@/lib/achievement-field-inference";
import { calculateAchievementScore } from "@/lib/achievement-scoring";
import { clampInferredFieldToAllowlist } from "@/lib/achievement-inferred-field-allowlist";
import {
  resolveAchievementComparableYearFromPayload,
  DUPLICATE_ACHIEVEMENT_RESPONSE,
  hasStudentAchievementDuplicate,
  normalizeAchievementNameForDuplicateKey,
  resolveComparableAchievementNameForDuplicate,
} from "@/lib/achievement-duplicate";
import { resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { applyAiReviewToDoc, runAchievementAiReview } from "@/lib/achievement-ai-review";
import { createStudentNotification } from "@/lib/student-notifications";
import { achievementOwnerUserIdFilter } from "@/lib/achievement-student-scope";
import {
  canStudentViewCertificate,
  isAchievementCertificateEligible,
  resolveCertificateUiStatus,
} from "@/lib/certificate-eligibility";
import {
  normalizeAttachmentsArray,
  serializeAttachmentsForStudentApi,
  type AchievementAttachmentObject,
} from "@/lib/achievement-attachments";

export const dynamic = "force-dynamic";

type PopulatedUser = {
  _id: { toString(): string };
  fullName?: string;
  name?: string;
  email?: string;
};

type NormalizedPayload = {
  achievementType: string;
  achievementCategory?: string;
  achievementName: string;
  nameAr?: string;
  nameEn?: string;
  customAchievementName?: string;
  achievementLevel: string;
  participationType: string;
  teamRole?: string;
  resultType: string;
  resultValue?: string;
  medalType?: string;
  rank?: string;
  nominationText?: string;
  specialAwardText?: string;
  recognitionText?: string;
  otherResultText?: string;
  olympiadField?: string;
  mawhibaAnnualSubject?: string;
  giftedDiscoveryScore?: number;
  achievementYear: number;
  achievementDate?: string;
  achievementClassification?: string;
  description?: string;
  image?: string;
  attachments?: AchievementAttachmentObject[];
  evidenceUrl?: string;
  evidenceFileName?: string;
  evidenceRequiredMode: "provided" | "skipped";
  requiresCommitteeReview: boolean;
  verificationStatus: "unverified" | "pending_committee_review";
  verificationSummary: string;
  evidenceMatchStatus: "unknown";
  evidenceExtractedData: Record<string, unknown> | null;
  featured: boolean;
};

const normalizeAchievementPayload = (body: Record<string, unknown>): NormalizedPayload => {
  const achievementType = String(body.achievementType || "");
  const achievementCategory = String(body.achievementCategory || achievementType || "competition");
  const achievementClassificationRaw = String(body.achievementClassification || "").trim();
  const allowedClass = [
    "academic","technical","cultural","research","volunteer",
    "qudurat","gifted_screening","mawhiba_annual","other",
  ];
  const achievementClassification = allowedClass.includes(achievementClassificationRaw)
    ? achievementClassificationRaw
    : "other";
  let achievementName = String(body.achievementName || "").trim();
  const nameAr = String(body.nameAr || "").trim() || undefined;
  const nameEn = String(body.nameEn || "").trim() || undefined;
  const customAchievementName = String(body.customAchievementName || "").trim() || undefined;
  let achievementLevel = String(body.achievementLevel || "");
  let participationType = String(body.participationType || "individual");
  let resultType = String(body.resultType || "");

  if (achievementType === "gifted_discovery") {
    achievementName = "exceptional_gifted";
    resultType = "participation";
    participationType = "individual";
  }

  if (achievementType === "mawhiba_annual") {
    achievementLevel = "kingdom";
    resultType = "rank";
    if (String(body.mawhibaAnnualRank || "").trim()) {
      achievementName = String(body.mawhibaAnnualRank || "").trim();
    }
  }

  if (achievementType === "qudrat") {
    achievementLevel = "kingdom";
    resultType = "participation";
    participationType = "individual";
    if (String(body.achievementName || "").trim()) {
      achievementName = String(body.achievementName || "").trim();
    }
  }

  const evidenceUrl = String(body.evidenceUrl || "").trim() || undefined;
  const evidenceFileName = String(body.evidenceFileName || "").trim() || undefined;
  const image = String(body.image || "").trim() || undefined;
  const attachments = Array.isArray(body.attachments)
    ? normalizeAttachmentsArray(body.attachments)
    : undefined;

  const hasEvidence = Boolean(evidenceUrl || evidenceFileName || image || (attachments && attachments.length > 0));
  const evidenceRequiredMode: "provided" | "skipped" =
    body.evidenceRequiredMode === "skipped" ? "skipped" : "provided";
  const requiresCommitteeReview = evidenceRequiredMode === "skipped";

  const verificationStatus: "unverified" | "pending_committee_review" = requiresCommitteeReview
    ? "pending_committee_review"
    : "unverified";

  const verificationSummary = requiresCommitteeReview
    ? "Evidence skipped by student. Requires committee review."
    : hasEvidence
      ? "Initial evidence metadata captured."
      : "No evidence metadata.";

  return {
    achievementType,
    achievementCategory,
    achievementClassification,
    achievementName,
    nameAr,
    nameEn,
    customAchievementName,
    achievementLevel,
    participationType,
    teamRole: String(body.teamRole || "").trim() || undefined,
    resultType,
    resultValue: String(body.resultValue || "").trim() || undefined,
    medalType: String(body.medalType || "").trim() || undefined,
    rank: String(body.rank || "").trim() || undefined,
    nominationText: String(body.nominationText || "").trim() || undefined,
    specialAwardText: String(body.specialAwardText || "").trim() || undefined,
    recognitionText: String(body.recognitionText || "").trim() || undefined,
    otherResultText: String(body.otherResultText || "").trim() || undefined,
    olympiadField: String(body.olympiadField || "").trim() || undefined,
    mawhibaAnnualSubject: String(body.mawhibaAnnualSubject || "").trim() || undefined,
    giftedDiscoveryScore:
      typeof body.giftedDiscoveryScore === "number"
        ? body.giftedDiscoveryScore
        : body.giftedDiscoveryScore
          ? Number(body.giftedDiscoveryScore)
          : undefined,
    achievementYear: (() => {
      const ds = String(body.achievementDate || "").trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(ds)) {
        const d = new Date(ds.slice(0, 10));
        if (!isNaN(d.getTime())) return d.getFullYear();
      }
      if (typeof body.achievementYear === "number") return body.achievementYear;
      const n = Number(body.achievementYear);
      return !isNaN(n) && n > 1900 ? n : new Date().getFullYear();
    })(),
    achievementDate: String(body.achievementDate || "").trim().slice(0, 10) || undefined,
    description: String(body.description || "").trim() || undefined,
    image,
    attachments,
    evidenceUrl,
    evidenceFileName,
    evidenceRequiredMode,
    requiresCommitteeReview,
    verificationStatus,
    verificationSummary,
    evidenceMatchStatus: "unknown",
    evidenceExtractedData: hasEvidence
      ? {
          evidenceUrl: evidenceUrl || null,
          evidenceFileName: evidenceFileName || null,
          hasImage: Boolean(image),
          attachmentsCount: attachments?.length || 0,
        }
      : null,
    featured: body.featured === true,
  };
};

const validateNormalizedPayload = (payload: NormalizedPayload): string[] => {
  const errors: string[] = [];

  if (!payload.achievementType) errors.push("Achievement type is required");
  if (!payload.achievementName && !payload.customAchievementName) errors.push("Achievement name is required");
  if (!payload.achievementLevel) errors.push("Achievement level is required");
  if (!payload.resultType) errors.push("Result type is required");

  if (payload.participationType === "team" && !payload.teamRole) {
    errors.push("Team role is required for team participation");
  }

  if (payload.participationType === "individual") {
    payload.teamRole = undefined;
  }

  if (payload.achievementType === "gifted_discovery") {
    if (!payload.giftedDiscoveryScore || payload.giftedDiscoveryScore < 1600) {
      errors.push("Gifted discovery score must be at least 1600");
    }
  }

  if (payload.achievementType === "mawhiba_annual") {
    if (!payload.rank) errors.push("Mawhiba annual rank is required");
    if (!payload.mawhibaAnnualSubject) errors.push("Mawhiba annual subject is required");
  }

  if (
    payload.achievementType === "qudrat" &&
    !["qudrat_100", "qudrat_99", "qudrat_98"].includes(payload.achievementName)
  ) {
    errors.push("Qudrat achievement name must be qudrat_100, qudrat_99, or qudrat_98");
  }

  if (payload.resultType === "medal" && !payload.medalType) errors.push("Medal type is required for medal result");
  if (payload.resultType === "rank" && !payload.rank) errors.push("Rank is required for rank result");
  if (payload.resultType === "nomination" && !payload.nominationText) {
    errors.push("Nomination text is required for nomination result");
  }
  if (payload.resultType === "special_award" && !payload.specialAwardText) {
    errors.push("Special award text is required for special award result");
  }
  if (payload.resultType === "recognition" && !payload.recognitionText) {
    errors.push("Recognition text is required for recognition result");
  }
  if (payload.resultType === "other" && !payload.otherResultText) {
    errors.push("Other result text is required for other result type");
  }

  const hasEvidence = Boolean(
    payload.evidenceUrl || payload.evidenceFileName || payload.image || (payload.attachments && payload.attachments.length > 0)
  );
  if (payload.evidenceRequiredMode !== "skipped" && !hasEvidence) {
    errors.push("Evidence is required: provide file/link or choose committee review");
  }

  return errors;
};

// GET — current session user's achievements only (strict server-side isolation).
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const currentUser = await getCurrentDbUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const featured = searchParams.get("featured");
    const domain = searchParams.get("domain");
    const inferredField = searchParams.get("inferredField");
    const approvedParam = searchParams.get("approved");

    const query: Record<string, unknown> = {
      ...achievementOwnerUserIdFilter(currentUser._id),
    };

    if (featured === "true") {
      query.featured = true;
    }

    if (domain) {
      query.domain = domain;
    }

    if (inferredField) {
      query.inferredField = inferredField;
    }

    if (approvedParam === "true") {
      query.approved = true;
    } else if (approvedParam === "false") {
      query.approved = false;
    }

    const achievements = await Achievement.find(query)
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .limit(100);

    const formattedAchievements = achievements.map((achievement) => {
      const user = achievement.userId as unknown as PopulatedUser;
      const safeName =
        achievement.nameAr ||
        achievement.nameEn ||
        achievement.achievementName ||
        achievement.title ||
        achievement.customAchievementName ||
        "Achievement";
      const safeDate =
        achievement.date instanceof Date
          ? achievement.date
          : achievement.createdAt instanceof Date
            ? achievement.createdAt
            : achievement.achievementYear
              ? new Date(`${achievement.achievementYear}-01-01`)
              : null;
      const safeField = achievement.inferredField || achievement.domain || "";
      const normalizedLevel = achievement.achievementLevel || achievement.level || "";
      const normalizedType = achievement.achievementType || "";
      const normalizedResultType = achievement.resultType || "";
      const normalizedCategory =
        achievement.achievementCategory || achievement.achievementType || "competition";
      const safeResultValue =
        achievement.resultValue ||
        (achievement.medalType
          ? achievement.medalType
          : achievement.rank
            ? achievement.rank
            : normalizedResultType);
      const achievementAny = achievement as any;
      const pendingReReview = achievementAny.pendingReReview === true;
      const ws = achievementAny.workflowState as { resubmittedByStudent?: boolean } | undefined;
      const resubmittedByStudent = ws?.resubmittedByStudent === true;
      const { attachments: listAttachmentUrls } = serializeAttachmentsForStudentApi(achievement.attachments);
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
      const certLike = achievement as unknown as Parameters<typeof canStudentViewCertificate>[0];
      const certificateAvailable = canStudentViewCertificate(certLike);
      const achievementRec = achievement as unknown as Record<string, unknown>;
      const certificateStatus = resolveCertificateUiStatus(certLike);
      const certificateEligible = isAchievementCertificateEligible(certLike);
      const certificateIssuedAtIso =
        achievement.certificateIssuedAt instanceof Date
          ? achievement.certificateIssuedAt.toISOString()
          : achievementRec.certificateIssuedAt
            ? String(achievementRec.certificateIssuedAt)
            : null;
      const certificateApprovedByRole =
        typeof achievementRec.certificateApprovedByRole === "string"
          ? achievementRec.certificateApprovedByRole
          : null;
      return {
        id: achievement._id.toString(),
        // New fields
        achievementType: normalizedType,
        achievementCategory: normalizedCategory,
        achievementName: achievement.achievementName,
        nameAr: achievement.nameAr || safeName,
        nameEn: achievement.nameEn || safeName,
        customAchievementName: achievement.customAchievementName,
        achievementLevel: normalizedLevel,
        participationType: achievement.participationType,
        teamRole: achievement.teamRole,
        resultType: normalizedResultType,
        resultValue: safeResultValue,
        medalType: achievement.medalType,
        rank: achievement.rank,
        score: achievement.score,
        scoreBreakdown: achievement.scoreBreakdown,
        achievementYear: achievement.achievementYear,
        // Legacy fields (for backward compatibility)
        title: safeName,
        name: safeName,
        description: achievement.description,
        domain: safeField,
        inferredField: safeField,
        competition: achievement.competition || achievement.competitionName,
        organization: achievement.organization,
        date: safeDate ? safeDate.toISOString().split("T")[0] : "",
        year: achievement.achievementYear || (safeDate ? safeDate.getFullYear() : null),
        level: normalizedLevel,
        image: achievement.image || null,
        attachments: listAttachmentUrls,
        resubmittedByStudent,
        certificateNumber: achievement.certificateNumber,
        verificationStatus: achievement.verificationStatus || "unverified",
        approvalStatus,
        requiresCommitteeReview: achievement.requiresCommitteeReview || false,
        status: achievementAny.status || (achievement.approved ? "approved" : "pending"),
        isFeatured: achievementAny.isFeatured === true || achievement.featured === true,
        featured: achievement.featured,
        approved: achievement.approved,
        pendingReReview,
        certificateAvailable,
        certificateStatus,
        certificateEligible,
        certificateIssuedAt: certificateIssuedAtIso,
        certificateApprovedByRole,
        user: {
          id: user?._id?.toString?.() || "",
          fullName: user?.fullName || user?.name || "",
          email: user?.email || "",
        },
      };
    });

    return NextResponse.json(formattedAchievements);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST create new achievement
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // PART 1: Always use session user, never accept userId from frontend
    const currentUser = await getCurrentDbUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const normalized = normalizeAchievementPayload(body);

    const finalAchievementName =
      normalized.achievementName === "other"
        ? normalized.customAchievementName || "other"
        : normalized.achievementName === OLYMPIAD_EVENT_OTHER_VALUE
          ? (normalized.customAchievementName?.trim() || normalized.achievementName)
          : normalized.achievementName || normalized.customAchievementName || "Achievement";

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
        userId: currentUser._id as mongoose.Types.ObjectId,
        nameKeyNormalized: dupNameKey,
        comparableYear: dupComparableYear,
      }))
    ) {
      return NextResponse.json(
        { ok: false, ...DUPLICATE_ACHIEVEMENT_RESPONSE },
        { status: 409 }
      );
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
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    // PART 5: Calculate score (committee review => score 0)
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
        {
          error: "Score calculation failed",
          errors: scoreResult.validationErrors,
        },
        { status: 400 }
      );
    }

    // PART 6: Build achievement data object
    const achievementData: any = {
      userId: currentUser._id, // Always use session user
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
      status: "pending",
      isFeatured: false,
      featured: false,
      approved: false,
      evidenceRequiredMode: normalized.evidenceRequiredMode,
      verificationStatus: normalized.verificationStatus,
      verificationSummary: normalized.verificationSummary,
      evidenceExtractedData: normalized.evidenceExtractedData,
      evidenceMatchStatus: normalized.evidenceMatchStatus,
      requiresCommitteeReview: normalized.requiresCommitteeReview,
    };

    // Set achievement name (single source of truth)
    achievementData.achievementName = finalAchievementName;
    achievementData.nameAr = normalized.nameAr || finalAchievementName;
    achievementData.nameEn = normalized.nameEn || finalAchievementName;
    if (normalized.customAchievementName) achievementData.customAchievementName = normalized.customAchievementName;

    // Set result-specific fields
    if (normalized.medalType) achievementData.medalType = normalized.medalType;
    if (normalized.rank) achievementData.rank = normalized.rank;
    if (normalized.nominationText) achievementData.nominationText = normalized.nominationText;
    if (normalized.specialAwardText) achievementData.specialAwardText = normalized.specialAwardText;
    if (normalized.recognitionText) achievementData.recognitionText = normalized.recognitionText;
    if (normalized.otherResultText) achievementData.otherResultText = normalized.otherResultText;

    // Set participation-specific fields
    if (normalized.participationType === "team" && normalized.teamRole) achievementData.teamRole = normalized.teamRole;

    // Set type-specific fields
    // Keep compatibility fields if sent
    if (typeof body.programName === "string") achievementData.programName = body.programName;
    if (typeof body.customProgramName === "string") achievementData.customProgramName = body.customProgramName;
    if (typeof body.competitionName === "string") achievementData.competitionName = body.competitionName;
    if (typeof body.customCompetitionName === "string") achievementData.customCompetitionName = body.customCompetitionName;
    if (typeof body.exhibitionName === "string") achievementData.exhibitionName = body.exhibitionName;
    if (typeof body.customExhibitionName === "string") achievementData.customExhibitionName = body.customExhibitionName;
    if (typeof body.olympiadMeeting === "string") achievementData.olympiadMeeting = body.olympiadMeeting;
    if (normalized.olympiadField) achievementData.olympiadField = normalized.olympiadField;
    if (typeof body.excellenceProgramName === "string") achievementData.excellenceProgramName = body.excellenceProgramName;
    if (typeof body.customExcellenceProgramName === "string") achievementData.customExcellenceProgramName = body.customExcellenceProgramName;
    if (typeof body.qudratScore === "string") achievementData.qudratScore = body.qudratScore;
    if (typeof body.mawhibaAnnualRank === "string") achievementData.mawhibaAnnualRank = body.mawhibaAnnualRank;
    if (normalized.mawhibaAnnualSubject) achievementData.mawhibaAnnualSubject = normalized.mawhibaAnnualSubject;
    if (typeof normalized.giftedDiscoveryScore === "number") achievementData.giftedDiscoveryScore = normalized.giftedDiscoveryScore;

    // Legacy fields (for backward compatibility)
    if (normalized.description) achievementData.description = normalized.description;
    if (normalized.image) achievementData.image = normalized.image;
    if (normalized.attachments) achievementData.attachments = normalized.attachments;
    if (typeof body.certificateNumber === "string" && body.certificateNumber.trim()) {
      achievementData.certificateNumber = body.certificateNumber.trim();
    }
    if (normalized.evidenceUrl) achievementData.evidenceUrl = normalized.evidenceUrl;
    if (normalized.evidenceFileName) achievementData.evidenceFileName = normalized.evidenceFileName;

    // Backward-compatible mirrors
    achievementData.title = finalAchievementName;
    achievementData.domain = resolvedInferredField;
    achievementData.level = normalized.achievementLevel;
    const dateStr = normalized.achievementDate && /^\d{4}-\d{2}-\d{2}/.test(normalized.achievementDate)
      ? normalized.achievementDate
      : null;
    achievementData.date = dateStr ? new Date(dateStr) : new Date(`${normalized.achievementYear}-01-01`);
    if (normalized.achievementClassification) {
      achievementData.achievementClassification = normalized.achievementClassification;
    }

    // Create achievement
    const achievement = await Achievement.create(achievementData);

    const ai = await runAchievementAiReview({
      userId: String(currentUser._id),
      achievementId: achievement._id.toString(),
      achievementYear: normalized.achievementYear,
      achievementName: finalAchievementName,
      achievementLevel: normalized.achievementLevel,
      achievementType: normalized.achievementType,
      resultType: normalized.resultType,
      locale: "ar",
    });
    applyAiReviewToDoc(achievement, ai);
    await achievement.save();

    if (achievement.aiReviewStatus === "flagged") {
      try {
        await createStudentNotification({
          userId: currentUser._id,
          type: "ai_flag_notice",
          title: "تنبيه مراجعة أولية على إنجازك",
          message:
            String(achievement.aiSummary || "").trim() ||
            "تم رصد بعض الملاحظات الأولية على إدخالك قبل مراجعة الإدارة. هذا تنبيه إرشادي وليس قراراً نهائياً.",
          relatedAchievementId: achievement._id,
          metadata: { aiFlags: achievement.aiFlags ?? [], aiSuggestedAction: achievement.aiSuggestedAction },
        });
      } catch (notifyErr) {
        console.error("[ai_flag_notice]", notifyErr);
      }
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        achievementId: achievement._id.toString(),
        inferredField: achievement.inferredField,
        score: achievement.score,
        aiReviewStatus: achievement.aiReviewStatus,
        aiFlags: achievement.aiFlags,
        aiSummary: achievement.aiSummary,
        message: "Achievement created successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating achievement:", error);

    // Handle MongoDB validation errors
    if (error.name === "ValidationError") {
      const validationErrors: Record<string, string> = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAttachment from "@/models/TrainingAttachment";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  SUMMER_TRAINING_ACHIEVEMENT_NAME,
  UI_CATEGORY_SUMMER_TRAINING,
} from "@/constants/achievement-special-categories";
import { calculateAchievementScore } from "@/lib/achievement-scoring";
import { tryIssueCertificateForAchievementDoc } from "@/lib/certificate-issue";
import { getScoringConfig } from "@/lib/getScoringConfig";
import { queueHomeStatsRefresh } from "@/lib/home-stats-service";
import {
  isHighTrainingExcellenceRating,
  resolveTrainingExcellenceWeight,
} from "@/lib/partnerships/training-excellence-weight";
import type { AchievementAttachmentObject } from "@/lib/achievement-attachments";

const TRAINING_RECORD_NOTE_PREFIX = "summer_training_record:";

export type TrainingAutomationResult = {
  skipped: boolean;
  reason?: string;
  achievementId?: string;
  certificateIssued?: boolean;
  certificateId?: string | null;
  verificationPath?: string | null;
};

const parseAcademicYear = (value: string): number => {
  const match = String(value || "").match(/(20\d{2})/);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
};

const formatDateLabel = (value?: Date | null, locale: "ar" | "en" = "ar") => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB");
};

const buildAttachments = (
  rows: Array<{ type: string; fileName: string; storageKey: string }>,
  videoUrl?: string
): AchievementAttachmentObject[] => {
  const out: AchievementAttachmentObject[] = [];
  for (const row of rows) {
    const url = String(row.storageKey || "").trim();
    if (!url) continue;
    const lower = url.toLowerCase();
    const mime = row.type === "pdf" || lower.includes(".pdf")
      ? "application/pdf"
      : row.type === "image" || /\.(png|jpe?g|webp|gif)(\?|#|$)/.test(lower)
        ? "image/jpeg"
        : "application/octet-stream";
    out.push({ url, mimeType: mime, name: row.fileName || "attachment" });
  }
  if (videoUrl?.trim()) {
    out.push({
      url: videoUrl.trim(),
      mimeType: "text/uri-list",
      name: "training-video",
    });
  }
  return out;
};

const buildDescription = (input: {
  organizationName: string;
  volunteerHours?: number;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  academicYear: string;
  assignedTasks?: string;
  studentReflection?: string;
  opportunityTitle?: string;
  excellenceWeight: number;
  highExcellence: boolean;
}) => {
  const lines = [
    `برنامج التدريب الصيفي — ${input.organizationName}`,
    input.opportunityTitle ? `الفرصة: ${input.opportunityTitle}` : "",
    `الساعات: ${input.volunteerHours ?? 0}`,
    `الفترة: ${formatDateLabel(input.trainingStartDate)} — ${formatDateLabel(input.trainingEndDate)}`,
    `العام الدراسي: ${input.academicYear}`,
    input.assignedTasks ? `المهام: ${input.assignedTasks}` : "",
    input.studentReflection ? `أهم ما تعلمه الطالب: ${input.studentReflection}` : "",
    `training_weight:${input.excellenceWeight}`,
    input.highExcellence ? "training_high_excellence:1" : "",
  ].filter(Boolean);
  return lines.join("\n");
};

export const processTrainingCompletionAutomation = async (input: {
  recordId: string;
  reviewerId: mongoose.Types.ObjectId;
}): Promise<TrainingAutomationResult> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.recordId)) {
    return { skipped: true, reason: "invalid_record_id" };
  }

  const record = await TrainingCompletionRecord.findById(input.recordId);
  if (!record) return { skipped: true, reason: "record_not_found" };
  if (String(record.status) !== "approved") return { skipped: true, reason: "not_approved" };

  if (record.achievementId) {
    const existing = await Achievement.findById(record.achievementId);
    if (existing) {
      return {
        skipped: true,
        reason: "already_automated",
        achievementId: String(existing._id),
        certificateIssued: existing.certificateIssued === true,
        certificateId: existing.certificateId ? String(existing.certificateId) : null,
        verificationPath: existing.certificateVerificationToken
          ? `/verify/certificate/${String(existing.certificateVerificationToken)}`
          : null,
      };
    }
  }

  const duplicate = await Achievement.findOne({
    adminWorkflowNote: `${TRAINING_RECORD_NOTE_PREFIX}${String(record._id)}`,
  });
  if (duplicate) {
    record.achievementId = duplicate._id as mongoose.Types.ObjectId;
    record.automationCompletedAt = new Date();
    await record.save();
    return {
      skipped: true,
      reason: "already_automated",
      achievementId: String(duplicate._id),
      certificateIssued: duplicate.certificateIssued === true,
      certificateId: duplicate.certificateId ? String(duplicate.certificateId) : null,
      verificationPath: duplicate.certificateVerificationToken
        ? `/verify/certificate/${String(duplicate.certificateVerificationToken)}`
        : null,
    };
  }

  const application = await StudentTrainingApplication.findById(record.applicationId).lean();
  const [opportunity, attachments] = await Promise.all([
    application
      ? TrainingOpportunity.findById(application.opportunityId).lean()
      : Promise.resolve(null),
    TrainingAttachment.find({ recordId: record._id }).sort({ createdAt: 1 }).lean(),
  ]);

  const orgName = String(record.organizationName || "").trim() || "المؤسسة الشريكة";
  const opportunityTitle = String(opportunity?.title || "").trim();
  const titleAr = opportunityTitle
    ? `التدريب الصيفي - ${orgName}`
    : "برنامج التدريب الصيفي";
  const titleEn = opportunityTitle
    ? `Summer Training - ${orgName}`
    : "Summer Training Program";
  const highExcellence = isHighTrainingExcellenceRating({
    studentBenefitRating: record.studentBenefitRating,
    overallRecommendation: record.overallRecommendation,
  });
  const excellenceWeight = resolveTrainingExcellenceWeight({
    studentBenefitRating: record.studentBenefitRating,
    overallRecommendation: record.overallRecommendation,
  });
  const achievementYear = parseAcademicYear(record.academicYear);
  const hours = record.volunteerHours ?? 0;
  const periodAr = `${formatDateLabel(record.trainingStartDate, "ar")} — ${formatDateLabel(record.trainingEndDate, "ar")}`;
  const resultValue = `ساعات: ${hours} | الفترة: ${periodAr} | المؤسسة: ${orgName}${
    highExcellence ? " | تميز مرتفع" : ""
  }`;

  const attachmentObjects = buildAttachments(attachments, record.videoUrl);
  const firstImage = attachmentObjects.find((row) => row.mimeType.startsWith("image/"));
  const firstPdf = attachmentObjects.find((row) => row.mimeType.includes("pdf"));

  const scoringConfig = await getScoringConfig();
  const scoreResult = calculateAchievementScore({
    achievementType: UI_CATEGORY_SUMMER_TRAINING,
    achievementLevel: "school",
    resultType: "completion",
    achievementName: SUMMER_TRAINING_ACHIEVEMENT_NAME,
    participationType: "individual",
    scoringConfig,
  });

  const now = new Date();
  const achievement = await Achievement.create({
    userId: record.studentId,
    studentSourceType: "linked_user",
    achievementType: UI_CATEGORY_SUMMER_TRAINING,
    achievementCategory: UI_CATEGORY_SUMMER_TRAINING,
    achievementClassification: "volunteer",
    achievementName: SUMMER_TRAINING_ACHIEVEMENT_NAME,
    nameAr: titleAr,
    nameEn: titleEn,
    customAchievementName: opportunityTitle || orgName,
    customProgramName: orgName,
    programName: SUMMER_TRAINING_ACHIEVEMENT_NAME,
    achievementLevel: "school",
    level: "school",
    participationType: "individual",
    resultType: "completion",
    resultValue,
    achievementYear,
    date: record.trainingEndDate || record.trainingStartDate || new Date(`${achievementYear}-06-01`),
    description: buildDescription({
      organizationName: orgName,
      volunteerHours: hours,
      trainingStartDate: record.trainingStartDate,
      trainingEndDate: record.trainingEndDate,
      academicYear: record.academicYear,
      assignedTasks: record.assignedTasks,
      studentReflection: record.studentReflection,
      opportunityTitle,
      excellenceWeight,
      highExcellence,
    }),
    organization: orgName,
    image: firstImage?.url,
    evidenceUrl: firstPdf?.url || record.videoUrl || firstImage?.url,
    evidenceFileName: firstPdf?.name || (record.videoUrl ? "training-video" : undefined),
    attachments: attachmentObjects.length > 0 ? attachmentObjects : undefined,
    evidenceRequiredMode: attachmentObjects.length > 0 ? "provided" : "skipped",
    requiresCommitteeReview: false,
    verificationStatus: "unverified",
    verificationSummary: "Automated summer training completion",
    evidenceMatchStatus: "unknown",
    score: scoreResult.score,
    scoreBreakdown: scoreResult.scoreBreakdown as unknown as Record<string, unknown>,
    status: "approved",
    approved: true,
    isFeatured: false,
    featured: false,
    submittedByRole: "admin",
    submittedByAdminId: input.reviewerId,
    reviewedAt: now,
    reviewedBy: input.reviewerId,
    adminApprovedAt: now,
    adminApprovedBy: input.reviewerId,
    showInPublicPortfolio: true,
    publicPortfolioSuppressedByAdmin: false,
    showInHallOfFame: false,
    adminWorkflowNote: `${TRAINING_RECORD_NOTE_PREFIX}${String(record._id)}`,
    title: titleAr,
  });

  const certificateIssued = await tryIssueCertificateForAchievementDoc(achievement, {
    role: "admin",
    userId: input.reviewerId,
  });

  const savedAchievement = await Achievement.findById(achievement._id)
    .select("certificateId certificateVerificationToken")
    .lean();

  record.achievementId = achievement._id as mongoose.Types.ObjectId;
  record.automationCompletedAt = now;
  await record.save();

  if (application) {
    application.timeline = [
      ...(application.timeline || []),
      {
        at: now,
        action: "training_achievement_created",
        note: titleAr,
      },
    ];
    await StudentTrainingApplication.updateOne(
      { _id: application._id },
      { $set: { timeline: application.timeline } }
    );
  }

  queueHomeStatsRefresh();

  const achievementId = String(achievement._id);
  const certificateId = savedAchievement?.certificateId
    ? String(savedAchievement.certificateId)
    : null;
  const verificationToken = savedAchievement?.certificateVerificationToken
    ? String(savedAchievement.certificateVerificationToken)
    : null;

  return {
    skipped: false,
    achievementId,
    certificateIssued,
    certificateId,
    verificationPath: verificationToken
      ? `/verify/certificate/${verificationToken}`
      : certificateId
        ? `/certificates/verify/${certificateId}`
        : `/certificates/verify/${achievementId}`,
  };
};

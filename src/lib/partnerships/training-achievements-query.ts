import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { UI_CATEGORY_SUMMER_TRAINING } from "@/constants/achievement-special-categories";
import { formatCertificateDisplayId } from "@/lib/certificate-verify-lookup";

export const listTrainingAchievementsDashboard = async () => {
  await connectDB();

  const records = await TrainingCompletionRecord.find({
    status: "approved",
    achievementId: { $exists: true, $ne: null },
  })
    .sort({ automationCompletedAt: -1, reviewedAt: -1 })
    .limit(300)
    .lean();

  const achievementIds = records
    .map((row) => row.achievementId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const achievements = await Achievement.find({ _id: { $in: achievementIds } })
    .select(
      "certificateId certificateIssued certificateVerificationToken status achievementName achievementType userId"
    )
    .lean();
  const achievementMap = new Map(achievements.map((row) => [String(row._id), row]));

  const applicationIds = records.map((row) => row.applicationId);
  const applications = await StudentTrainingApplication.find({ _id: { $in: applicationIds } }).lean();
  const appMap = new Map(applications.map((row) => [String(row._id), row]));

  const opportunityIds = [...new Set(applications.map((row) => String(row.opportunityId)))];
  const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } }).select("title").lean();
  const oppMap = new Map(opportunities.map((row) => [String(row._id), row]));

  const items = records.map((record) => {
    const app = appMap.get(String(record.applicationId));
    const achievement = record.achievementId
      ? achievementMap.get(String(record.achievementId))
      : undefined;
    const opp = app ? oppMap.get(String(app.opportunityId)) : undefined;
    return {
      recordId: String(record._id),
      achievementId: record.achievementId ? String(record.achievementId) : null,
      studentId: String(record.studentId),
      studentName: app?.studentSnapshot?.fullName || "",
      studentStage: app?.studentSnapshot?.stage || "",
      organizationId: String(record.organizationId),
      organizationName: record.organizationName || "",
      opportunityTitle: opp?.title || "",
      volunteerHours: record.volunteerHours ?? null,
      academicYear: record.academicYear,
      achievementStatus: achievement?.status || null,
      certificateIssued: achievement?.certificateIssued === true,
      certificateDisplayId: achievement?.certificateId
        ? formatCertificateDisplayId(String(achievement.certificateId))
        : null,
      certificateVerifyPath: achievement?.certificateVerificationToken
        ? `/verify/certificate/${String(achievement.certificateVerificationToken)}`
        : achievement?.certificateId
          ? `/certificates/verify/${String(achievement.certificateId)}`
          : null,
      automationCompletedAt: record.automationCompletedAt
        ? new Date(record.automationCompletedAt).toISOString()
        : null,
    };
  });

  const traineeCount = items.length;
  const organizationCount = new Set(items.map((row) => row.organizationId)).size;
  const totalHours = items.reduce((sum, row) => sum + (row.volunteerHours || 0), 0);

  const byStage: Record<string, number> = {};
  const byOrganization: Record<string, number> = {};
  for (const row of items) {
    const stage = row.studentStage || "unknown";
    byStage[stage] = (byStage[stage] || 0) + 1;
    const org = row.organizationName || "unknown";
    byOrganization[org] = (byOrganization[org] || 0) + 1;
  }

  const summerTrainingAchievementCount = await Achievement.countDocuments({
    $or: [
      { achievementType: UI_CATEGORY_SUMMER_TRAINING },
      { achievementCategory: UI_CATEGORY_SUMMER_TRAINING },
      { achievementName: "summer_training" },
    ],
    status: "approved",
  });

  return {
    items,
    dashboard: {
      traineeCount,
      organizationCount,
      totalHours,
      summerTrainingAchievementCount,
      byStage: Object.entries(byStage).map(([key, count]) => ({ key, count })),
      byOrganization: Object.entries(byOrganization).map(([key, count]) => ({ key, count })),
    },
  };
};

export const getTrainingCertificatePayload = async (rawId: string) => {
  await connectDB();
  const id = String(rawId || "").trim();
  if (!id) return null;

  let achievement = mongoose.Types.ObjectId.isValid(id)
    ? await Achievement.findById(id).lean()
    : null;

  if (!achievement) {
    achievement = await Achievement.findOne({
      certificateVerificationToken: id,
      achievementType: UI_CATEGORY_SUMMER_TRAINING,
    }).lean();
  }

  if (!achievement) {
    achievement = await Achievement.findOne({ certificateId: id, achievementType: UI_CATEGORY_SUMMER_TRAINING }).lean();
  }

  if (!achievement) return null;
  if (String(achievement.achievementType || "") !== UI_CATEGORY_SUMMER_TRAINING) return null;

  const record = await TrainingCompletionRecord.findOne({ achievementId: achievement._id }).lean();

  return {
    achievementId: String(achievement._id),
    certificateType: "Training Certificate",
    certificateIssued: achievement.certificateIssued === true,
    certificateId: achievement.certificateId ? String(achievement.certificateId) : null,
    certificateDisplayId: achievement.certificateId
      ? formatCertificateDisplayId(String(achievement.certificateId))
      : null,
    verificationToken: achievement.certificateVerificationToken
      ? String(achievement.certificateVerificationToken)
      : null,
    verifyPath: achievement.certificateVerificationToken
      ? `/verify/certificate/${String(achievement.certificateVerificationToken)}`
      : achievement.certificateId
        ? `/certificates/verify/${String(achievement.certificateId)}`
        : null,
    certificateSnapshot: achievement.certificateSnapshot || null,
    studentId: achievement.userId ? String(achievement.userId) : null,
    organizationName: record?.organizationName || achievement.organization || "",
    volunteerHours: record?.volunteerHours ?? null,
    trainingStartDate: record?.trainingStartDate
      ? new Date(record.trainingStartDate).toISOString()
      : null,
    trainingEndDate: record?.trainingEndDate ? new Date(record.trainingEndDate).toISOString() : null,
    academicYear: record?.academicYear || String(achievement.achievementYear || ""),
    status: achievement.status,
  };
};

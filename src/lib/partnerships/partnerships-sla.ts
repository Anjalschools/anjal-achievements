import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export const computeSlaDueDates = (input: {
  status: string;
  submittedAt?: Date;
  settings?: {
    reviewSlaHours: number;
    institutionDecisionSlaDays: number;
    trainingCompletionSlaDays: number;
  };
}) => {
  const settings = input.settings;
  const submitted = input.submittedAt || new Date();
  return {
    slaReviewDueAt: new Date(submitted.getTime() + (settings?.reviewSlaHours ?? 72) * 60 * 60 * 1000),
    slaInstitutionDueAt: new Date(
      submitted.getTime() + (settings?.institutionDecisionSlaDays ?? 14) * 24 * 60 * 60 * 1000
    ),
    slaCompletionDueAt: new Date(
      submitted.getTime() + (settings?.trainingCompletionSlaDays ?? 30) * 24 * 60 * 60 * 1000
    ),
  };
};

export const getPartnershipSlaDashboard = async () => {
  await connectDB();
  const settings = await getPartnershipProgramSettings();
  const now = new Date();

  const [reviewOverdue, institutionOverdue, completionOverdue, avgReviewHours, avgInstitutionDays] =
    await Promise.all([
      StudentTrainingApplication.countDocuments({
        archived: { $ne: true },
        status: { $in: ["submitted", "under_review"] },
        $or: [
          { slaReviewDueAt: { $lt: now } },
          { slaReviewDueAt: { $exists: false }, submittedAt: { $lt: hoursAgo(settings.reviewSlaHours) } },
        ],
      }),
      StudentTrainingApplication.countDocuments({
        archived: { $ne: true },
        status: "institution_review",
        $or: [
          { slaInstitutionDueAt: { $lt: now } },
          {
            slaInstitutionDueAt: { $exists: false },
            submittedAt: { $lt: daysAgo(settings.institutionDecisionSlaDays) },
          },
        ],
      }),
      StudentTrainingApplication.countDocuments({
        archived: { $ne: true },
        status: "accepted",
        _id: {
          $nin: await TrainingCompletionRecord.find({ status: "approved" }).distinct("applicationId"),
        },
        $or: [
          { slaCompletionDueAt: { $lt: now } },
          {
            slaCompletionDueAt: { $exists: false },
            reviewedAt: { $lt: daysAgo(settings.trainingCompletionSlaDays) },
          },
        ],
      }),
      StudentTrainingApplication.aggregate([
        {
          $match: {
            reviewedAt: { $exists: true },
            submittedAt: { $exists: true },
            archived: { $ne: true },
          },
        },
        {
          $project: {
            hours: {
              $divide: [{ $subtract: ["$reviewedAt", "$submittedAt"] }, 1000 * 60 * 60],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: "$hours" } } },
      ]),
      StudentTrainingApplication.aggregate([
        {
          $match: {
            status: { $in: ["accepted", "completed", "rejected"] },
            institutionStatus: { $exists: true },
            archived: { $ne: true },
          },
        },
        { $limit: 200 },
      ]),
    ]);

  const institutionSamples = avgInstitutionDays as Array<{ submittedAt?: Date; reviewedAt?: Date }>;
  let institutionAvg = 0;
  if (institutionSamples.length > 0) {
    const total = institutionSamples.reduce((sum, row) => {
      const start = row.submittedAt ? new Date(row.submittedAt).getTime() : 0;
      const end = row.reviewedAt ? new Date(row.reviewedAt).getTime() : 0;
      if (!start || !end) return sum;
      return sum + (end - start) / (1000 * 60 * 60 * 24);
    }, 0);
    institutionAvg = Math.round((total / institutionSamples.length) * 10) / 10;
  }

  return {
    settings: {
      reviewSlaHours: settings.reviewSlaHours,
      institutionDecisionSlaDays: settings.institutionDecisionSlaDays,
      trainingCompletionSlaDays: settings.trainingCompletionSlaDays,
    },
    overdue: {
      review: reviewOverdue,
      institution: institutionOverdue,
      completion: completionOverdue,
    },
    averages: {
      reviewHours: Math.round((avgReviewHours[0]?.avg ?? 0) * 10) / 10,
      institutionDays: institutionAvg,
    },
    measuredAt: now.toISOString(),
  };
};

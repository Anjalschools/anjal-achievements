import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";

export type StudentTrainingDashboardStats = {
  applicationsSubmitted: number;
  acceptedOpportunities: number;
  approvedTrainingHours: number;
  trainingInstitutions: number;
};

export const loadStudentTrainingDashboardStats = async (
  studentId: mongoose.Types.ObjectId
): Promise<StudentTrainingDashboardStats> => {
  await connectDB();

  const [applicationsSubmitted, acceptedOpportunities, completionAgg] = await Promise.all([
    StudentTrainingApplication.countDocuments({
      studentId,
      archived: { $ne: true },
      status: { $ne: "withdrawn" },
    }),
    StudentTrainingApplication.countDocuments({
      studentId,
      archived: { $ne: true },
      status: { $in: ["accepted", "completed"] },
    }),
    TrainingCompletionRecord.aggregate<{ totalHours: number; institutions: string[] }>([
      { $match: { studentId, status: "approved" } },
      {
        $group: {
          _id: null,
          totalHours: { $sum: { $ifNull: ["$volunteerHours", 0] } },
          institutions: { $addToSet: "$organizationId" },
        },
      },
    ]),
  ]);

  const agg = completionAgg[0];
  return {
    applicationsSubmitted,
    acceptedOpportunities,
    approvedTrainingHours: Number(agg?.totalHours || 0),
    trainingInstitutions: Array.isArray(agg?.institutions) ? agg.institutions.length : 0,
  };
};

import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipProgramSettings from "@/models/PartnershipProgramSettings";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";

/** Registers a logical snapshot marker for a future backup subsystem. */
export const registerPartnershipBackupSnapshot = async (input: {
  academicYear?: string;
  reason: string;
  actorId?: mongoose.Types.ObjectId;
}) => {
  await connectDB();
  const now = new Date();
  const [applications, opportunities, reports] = await Promise.all([
    StudentTrainingApplication.countDocuments(
      input.academicYear ? { academicYear: input.academicYear } : {}
    ),
    TrainingOpportunity.countDocuments(input.academicYear ? { academicYear: input.academicYear } : {}),
    TrainingCompletionRecord.countDocuments(
      input.academicYear ? { academicYear: input.academicYear } : {}
    ),
  ]);

  await PartnershipProgramSettings.findOneAndUpdate(
    { singletonKey: "default" },
    {
      $set: {
        lastBackupSnapshotAt: now,
        updatedBy: input.actorId,
      },
    },
    { upsert: true }
  );

  return {
    registeredAt: now.toISOString(),
    reason: input.reason,
    academicYear: input.academicYear || null,
    counts: { applications, opportunities, reports },
    note: "Snapshot marker registered for future backup pipeline integration",
  };
};

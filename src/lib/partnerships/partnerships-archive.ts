import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  getPartnershipProgramSettings,
  updatePartnershipProgramSettings,
} from "@/lib/partnerships/partnerships-settings-service";
import { registerPartnershipBackupSnapshot } from "@/lib/partnerships/partnerships-backup-integration";

export const archivePartnershipAcademicYear = async (input: {
  academicYear: string;
  actorId?: mongoose.Types.ObjectId;
}) => {
  await connectDB();
  const academicYear = String(input.academicYear || "").trim();
  if (!academicYear) throw new Error("academicYear is required");

  const now = new Date();
  const [opportunities, applications] = await Promise.all([
    TrainingOpportunity.updateMany(
      { academicYear, archived: { $ne: true } },
      { $set: { archived: true, archivedAt: now, active: false, visible: false } }
    ),
    StudentTrainingApplication.updateMany(
      { academicYear, archived: { $ne: true } },
      { $set: { archived: true, archivedAt: now } }
    ),
  ]);

  const applicationIds = await StudentTrainingApplication.find({ academicYear }).distinct("_id");
  const threads = await PartnershipThread.updateMany(
    { applicationId: { $in: applicationIds } },
    { $set: { archived: true, archivedAt: now } }
  ).catch(() => ({ modifiedCount: 0 }));

  await updatePartnershipProgramSettings(
    {
      archiveMode: true,
      archivedAcademicYear: academicYear,
    },
    input.actorId
  );

  if ((await getPartnershipProgramSettings()).backupIntegrationEnabled) {
    await registerPartnershipBackupSnapshot({
      academicYear,
      reason: "archive_cycle",
      actorId: input.actorId,
    });
  }

  return {
    academicYear,
    archivedAt: now.toISOString(),
    opportunitiesArchived: opportunities.modifiedCount,
    applicationsArchived: applications.modifiedCount,
    threadsArchived: (threads as { modifiedCount?: number }).modifiedCount ?? 0,
  };
};

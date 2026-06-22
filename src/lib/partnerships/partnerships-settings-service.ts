import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipProgramSettings from "@/models/PartnershipProgramSettings";
import {
  DEFAULT_PARTNERSHIP_PROGRAM_SETTINGS,
  type PartnershipProgramSettingsData,
} from "@/lib/partnerships/partnerships-settings-defaults";
import { normalizePartnershipMessageActionsMode } from "@/lib/partnerships/partnership-message-ui-constants";

const serialize = (row: Record<string, unknown>): PartnershipProgramSettingsData => ({
  defaultAcademicYear: String(row.defaultAcademicYear || ""),
  maxOpportunitiesPerStudent: Number(row.maxOpportunitiesPerStudent ?? 1),
  allowMultipleApplications: row.allowMultipleApplications === true,
  showPortfolioToInstitutions: row.showPortfolioToInstitutions !== false,
  showExcellenceScoreToInstitutions: row.showExcellenceScoreToInstitutions !== false,
  allowVideoUpload: row.allowVideoUpload !== false,
  maxAttachmentSizeMb: Number(row.maxAttachmentSizeMb ?? 10),
  reviewSlaHours: Number(row.reviewSlaHours ?? 72),
  institutionDecisionSlaDays: Number(row.institutionDecisionSlaDays ?? 14),
  trainingCompletionSlaDays: Number(row.trainingCompletionSlaDays ?? 30),
  archiveMode: row.archiveMode === true,
  archivedAcademicYear: String(row.archivedAcademicYear || ""),
  backupIntegrationEnabled: row.backupIntegrationEnabled !== false,
  lastBackupSnapshotAt: row.lastBackupSnapshotAt
    ? new Date(row.lastBackupSnapshotAt as Date).toISOString()
    : null,
  messageActionsMode: normalizePartnershipMessageActionsMode(row.messageActionsMode),
});

export const getPartnershipProgramSettings = async (): Promise<PartnershipProgramSettingsData> => {
  await connectDB();
  const row = await PartnershipProgramSettings.findOne({ singletonKey: "default" }).lean();
  if (!row) return { ...DEFAULT_PARTNERSHIP_PROGRAM_SETTINGS };
  return serialize(row as unknown as Record<string, unknown>);
};

export const updatePartnershipProgramSettings = async (
  patch: Partial<PartnershipProgramSettingsData>,
  updatedBy?: mongoose.Types.ObjectId
) => {
  await connectDB();
  const update: Record<string, unknown> = { updatedBy };
  if (patch.defaultAcademicYear != null) update.defaultAcademicYear = String(patch.defaultAcademicYear).trim();
  if (patch.maxOpportunitiesPerStudent != null) {
    update.maxOpportunitiesPerStudent = Math.min(Math.max(Number(patch.maxOpportunitiesPerStudent), 1), 10);
  }
  if (typeof patch.allowMultipleApplications === "boolean") {
    update.allowMultipleApplications = patch.allowMultipleApplications;
  }
  if (typeof patch.showPortfolioToInstitutions === "boolean") {
    update.showPortfolioToInstitutions = patch.showPortfolioToInstitutions;
  }
  if (typeof patch.showExcellenceScoreToInstitutions === "boolean") {
    update.showExcellenceScoreToInstitutions = patch.showExcellenceScoreToInstitutions;
  }
  if (typeof patch.allowVideoUpload === "boolean") update.allowVideoUpload = patch.allowVideoUpload;
  if (patch.maxAttachmentSizeMb != null) {
    update.maxAttachmentSizeMb = Math.min(Math.max(Number(patch.maxAttachmentSizeMb), 1), 50);
  }
  if (patch.reviewSlaHours != null) {
    update.reviewSlaHours = Math.min(Math.max(Number(patch.reviewSlaHours), 1), 720);
  }
  if (patch.institutionDecisionSlaDays != null) {
    update.institutionDecisionSlaDays = Math.min(Math.max(Number(patch.institutionDecisionSlaDays), 1), 180);
  }
  if (patch.trainingCompletionSlaDays != null) {
    update.trainingCompletionSlaDays = Math.min(Math.max(Number(patch.trainingCompletionSlaDays), 1), 365);
  }
  if (typeof patch.archiveMode === "boolean") update.archiveMode = patch.archiveMode;
  if (patch.archivedAcademicYear != null) update.archivedAcademicYear = String(patch.archivedAcademicYear).trim();
  if (typeof patch.backupIntegrationEnabled === "boolean") {
    update.backupIntegrationEnabled = patch.backupIntegrationEnabled;
  }
  if (patch.messageActionsMode != null) {
    update.messageActionsMode = normalizePartnershipMessageActionsMode(patch.messageActionsMode);
  }

  const row = await PartnershipProgramSettings.findOneAndUpdate(
    { singletonKey: "default" },
    { $set: update, $setOnInsert: { singletonKey: "default" } },
    { upsert: true, new: true }
  ).lean();

  return serialize(row as unknown as Record<string, unknown>);
};

export const isPartnershipArchiveModeActive = async (academicYear?: string) => {
  const settings = await getPartnershipProgramSettings();
  if (!settings.archiveMode) return false;
  if (!settings.archivedAcademicYear) return true;
  if (!academicYear) return true;
  return String(academicYear) === settings.archivedAcademicYear;
};

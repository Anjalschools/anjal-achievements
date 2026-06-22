import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPartnershipProgramSettings extends Document {
  singletonKey: string;
  defaultAcademicYear: string;
  maxOpportunitiesPerStudent: number;
  allowMultipleApplications: boolean;
  showPortfolioToInstitutions: boolean;
  showExcellenceScoreToInstitutions: boolean;
  allowVideoUpload: boolean;
  maxAttachmentSizeMb: number;
  reviewSlaHours: number;
  institutionDecisionSlaDays: number;
  trainingCompletionSlaDays: number;
  archiveMode: boolean;
  archivedAcademicYear: string;
  backupIntegrationEnabled: boolean;
  lastBackupSnapshotAt?: Date;
  messageActionsMode?: "dropdown" | "inline";
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PartnershipProgramSettingsSchema = new Schema<IPartnershipProgramSettings>(
  {
    singletonKey: { type: String, required: true, unique: true, default: "default" },
    defaultAcademicYear: { type: String, trim: true, maxlength: 80, default: "" },
    maxOpportunitiesPerStudent: { type: Number, min: 1, max: 10, default: 1 },
    allowMultipleApplications: { type: Boolean, default: false },
    showPortfolioToInstitutions: { type: Boolean, default: true },
    showExcellenceScoreToInstitutions: { type: Boolean, default: true },
    allowVideoUpload: { type: Boolean, default: true },
    maxAttachmentSizeMb: { type: Number, min: 1, max: 50, default: 10 },
    reviewSlaHours: { type: Number, min: 1, max: 720, default: 72 },
    institutionDecisionSlaDays: { type: Number, min: 1, max: 180, default: 14 },
    trainingCompletionSlaDays: { type: Number, min: 1, max: 365, default: 30 },
    archiveMode: { type: Boolean, default: false },
    archivedAcademicYear: { type: String, trim: true, maxlength: 80, default: "" },
    backupIntegrationEnabled: { type: Boolean, default: true },
    messageActionsMode: { type: String, enum: ["dropdown", "inline"], default: "dropdown" },
    lastBackupSnapshotAt: { type: Date },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const PartnershipProgramSettings: Model<IPartnershipProgramSettings> =
  mongoose.models.PartnershipProgramSettings ||
  mongoose.model<IPartnershipProgramSettings>(
    "PartnershipProgramSettings",
    PartnershipProgramSettingsSchema
  );

export default PartnershipProgramSettings;

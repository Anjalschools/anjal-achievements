import mongoose, { Document, Model, Schema, Types } from "mongoose";
import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";

export type BackupRecordStatus = "pending" | "completed" | "failed";
export type BackupKind = "database" | "disaster_recovery";
export type RetentionTier = "daily" | "weekly" | "monthly";

export interface IBackupRecord extends Document {
  createdBy: Types.ObjectId;
  backupType: BackupModuleId;
  backupModule: BackupModuleId;
  backupKind?: BackupKind;
  status: BackupRecordStatus;
  sizeBytes?: number;
  manifestVersion?: string;
  storageProvider: BackupStorageProviderId;
  storageKey?: string;
  fileName: string;
  recordCounts?: Record<string, number>;
  academicYearLabel?: string;
  note?: string;
  errorMessage?: string;
  includesObjectStorage?: boolean;
  objectCount?: number;
  objectSizeBytes?: number;
  recoveryReadinessScore?: number;
  retentionTier?: RetentionTier;
  validationStatus?: "pending" | "pass" | "fail";
  lastValidatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BackupRecordSchema = new Schema<IBackupRecord>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    backupType: { type: String, required: true, trim: true },
    backupModule: { type: String, required: true, trim: true },
    backupKind: { type: String, enum: ["database", "disaster_recovery"], default: "database" },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    sizeBytes: { type: Number, min: 0 },
    manifestVersion: { type: String, trim: true, maxlength: 20 },
    storageProvider: { type: String, enum: ["local", "r2"], required: true },
    storageKey: { type: String, trim: true, maxlength: 2000 },
    fileName: { type: String, required: true, trim: true, maxlength: 300 },
    recordCounts: { type: Schema.Types.Mixed },
    academicYearLabel: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 500 },
    errorMessage: { type: String, trim: true, maxlength: 2000 },
    includesObjectStorage: { type: Boolean, default: false },
    objectCount: { type: Number, min: 0 },
    objectSizeBytes: { type: Number, min: 0 },
    recoveryReadinessScore: { type: Number, min: 0, max: 100 },
    retentionTier: { type: String, enum: ["daily", "weekly", "monthly"], default: "daily" },
    validationStatus: { type: String, enum: ["pending", "pass", "fail"], default: "pending" },
    lastValidatedAt: { type: Date },
  },
  { timestamps: true }
);

BackupRecordSchema.index({ createdAt: -1 });
BackupRecordSchema.index({ createdBy: 1, createdAt: -1 });
BackupRecordSchema.index({ backupModule: 1, createdAt: -1 });

const BackupRecord: Model<IBackupRecord> =
  mongoose.models.BackupRecord || mongoose.model<IBackupRecord>("BackupRecord", BackupRecordSchema);

export default BackupRecord;

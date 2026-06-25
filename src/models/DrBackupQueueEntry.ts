import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type DrBackupQueueEntryStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type DrBackupQueuePayloadDocument = {
  recordId: string;
  input: {
    moduleId: string;
    storageProvider: string;
    createdByUserId: string;
    includeObjects?: boolean;
    retentionTier?: string;
    note?: string;
  };
  audit?: {
    actor: {
      id?: string;
      name?: string;
      email?: string;
      role?: string;
    };
  };
  source?: "api" | "cron" | "recovery";
  pruneExpiredOnComplete?: boolean;
};

export interface IDrBackupQueueEntry extends Document {
  recordId: Types.ObjectId;
  status: DrBackupQueueEntryStatus;
  payload: DrBackupQueuePayloadDocument;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  enqueuedAt: Date;
  dequeuedAt?: Date;
  ackedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  lastError?: string;
  workerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DrBackupQueueEntrySchema = new Schema<IDrBackupQueueEntry>(
  {
    recordId: { type: Schema.Types.ObjectId, ref: "BackupRecord", required: true, unique: true },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed", "cancelled"],
      default: "queued",
      required: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    attempts: { type: Number, min: 0, default: 0 },
    maxAttempts: { type: Number, min: 1, default: 1 },
    nextRetryAt: { type: Date },
    enqueuedAt: { type: Date, default: Date.now },
    dequeuedAt: { type: Date },
    ackedAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    lastError: { type: String, trim: true, maxlength: 2000 },
    workerId: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

DrBackupQueueEntrySchema.index({ status: 1, enqueuedAt: 1 });
DrBackupQueueEntrySchema.index({ status: 1, nextRetryAt: 1 });
DrBackupQueueEntrySchema.index({ workerId: 1, status: 1 });

const DrBackupQueueEntry: Model<IDrBackupQueueEntry> =
  mongoose.models.DrBackupQueueEntry ||
  mongoose.model<IDrBackupQueueEntry>("DrBackupQueueEntry", DrBackupQueueEntrySchema);

export default DrBackupQueueEntry;

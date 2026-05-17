import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICronJobLock extends Document {
  jobKey: string;
  holder: string;
  lockedAt: Date;
  expiresAt: Date;
}

const CronJobLockSchema = new Schema<ICronJobLock>(
  {
    jobKey: { type: String, required: true, unique: true, index: true },
    holder: { type: String, required: true },
    lockedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: false }
);

const CronJobLock: Model<ICronJobLock> =
  mongoose.models.CronJobLock || mongoose.model<ICronJobLock>("CronJobLock", CronJobLockSchema);

export default CronJobLock;

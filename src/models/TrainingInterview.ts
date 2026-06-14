import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { TRAINING_INTERVIEW_STATUSES } from "@/lib/partnerships/institution-experience-constants";

export interface ITrainingInterview extends Document {
  applicationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  scheduledAt: Date;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  recordingUrl?: string;
  attendance?: "pending" | "attended" | "no_show";
  resultNotes?: string;
  status: (typeof TRAINING_INTERVIEW_STATUSES)[number];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingInterviewSchema = new Schema<ITrainingInterview>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerOrganization",
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    location: { type: String, trim: true, maxlength: 500 },
    meetingUrl: { type: String, trim: true, maxlength: 2000 },
    notes: { type: String, trim: true, maxlength: 4000 },
    recordingUrl: { type: String, trim: true, maxlength: 2000 },
    attendance: {
      type: String,
      enum: ["pending", "attended", "no_show"],
      default: "pending",
    },
    resultNotes: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: TRAINING_INTERVIEW_STATUSES,
      default: "scheduled",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TrainingInterviewSchema.index({ applicationId: 1, scheduledAt: -1 });

const TrainingInterview: Model<ITrainingInterview> =
  mongoose.models.TrainingInterview ||
  mongoose.model<ITrainingInterview>("TrainingInterview", TrainingInterviewSchema);

export default TrainingInterview;

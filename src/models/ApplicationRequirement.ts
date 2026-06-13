import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { APPLICATION_REQUIREMENT_STATUSES } from "@/lib/partnerships/institution-experience-constants";

export interface IApplicationRequirement extends Document {
  applicationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  title: string;
  description?: string;
  required: boolean;
  fileTypes: string[];
  dueDate?: Date;
  status: (typeof APPLICATION_REQUIREMENT_STATUSES)[number];
  attachmentId?: Types.ObjectId;
  submittedAt?: Date;
  submittedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationRequirementSchema = new Schema<IApplicationRequirement>(
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
    title: { type: String, required: true, trim: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 4000 },
    required: { type: Boolean, default: true },
    fileTypes: { type: [String], default: [] },
    dueDate: { type: Date, index: true },
    status: {
      type: String,
      enum: APPLICATION_REQUIREMENT_STATUSES,
      default: "pending",
      index: true,
    },
    attachmentId: { type: Schema.Types.ObjectId, ref: "TrainingAttachment", sparse: true },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ApplicationRequirementSchema.index({ applicationId: 1, createdAt: 1 });

const ApplicationRequirement: Model<IApplicationRequirement> =
  mongoose.models.ApplicationRequirement ||
  mongoose.model<IApplicationRequirement>("ApplicationRequirement", ApplicationRequirementSchema);

export default ApplicationRequirement;

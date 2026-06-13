import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  PARTNERSHIP_TARGET_GENDERS,
  PARTNERSHIP_TARGET_GRADE_VALUES,
  PARTNERSHIP_TARGET_STAGES,
  type PartnershipTargetGender,
  type PartnershipTargetStage,
} from "@/lib/partnerships/partnerships-constants";

export interface ITrainingOpportunity extends Document {
  title: string;
  description?: string;
  organizationId: Types.ObjectId;
  targetGender: PartnershipTargetGender;
  targetStages: PartnershipTargetStage[];
  targetGrades: string[];
  seats: number;
  reserveSeats?: number;
  academicYear?: string;
  archived?: boolean;
  archivedAt?: Date;
  registrationStart?: Date;
  registrationEnd?: Date;
  trainingStart?: Date;
  trainingEnd?: Date;
  visible: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingOpportunitySchema = new Schema<ITrainingOpportunity>(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 12000 },
    organizationId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    targetGender: {
      type: String,
      enum: PARTNERSHIP_TARGET_GENDERS,
      required: true,
      default: "both",
      index: true,
    },
    targetStages: {
      type: [{ type: String, enum: PARTNERSHIP_TARGET_STAGES }],
      default: [],
    },
    targetGrades: {
      type: [{ type: String, enum: PARTNERSHIP_TARGET_GRADE_VALUES }],
      default: [],
    },
    seats: { type: Number, required: true, min: 0, default: 0 },
    reserveSeats: { type: Number, min: 0, default: 0 },
    academicYear: { type: String, trim: true, maxlength: 80, index: true },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    registrationStart: { type: Date },
    registrationEnd: { type: Date, index: true },
    trainingStart: { type: Date },
    trainingEnd: { type: Date },
    visible: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

TrainingOpportunitySchema.index({ visible: 1, active: 1, registrationEnd: -1 });
TrainingOpportunitySchema.index({ organizationId: 1, active: 1, createdAt: -1 });

const TrainingOpportunity: Model<ITrainingOpportunity> =
  mongoose.models.TrainingOpportunity ||
  mongoose.model<ITrainingOpportunity>("TrainingOpportunity", TrainingOpportunitySchema);

export default TrainingOpportunity;

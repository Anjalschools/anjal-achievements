import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IInstitutionSupervisorFeedback extends Document {
  organizationId: Types.ObjectId;
  academicYearId?: Types.ObjectId;
  academicYearLabel: string;
  supervisorId: Types.ObjectId;
  cooperation: number;
  commitment: number;
  responseSpeed: number;
  reportQuality: number;
  communication: number;
  notes?: string;
  reviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ratingField = { type: Number, required: true, min: 1, max: 5 };

const InstitutionSupervisorFeedbackSchema = new Schema<IInstitutionSupervisorFeedback>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerOrganization",
      required: true,
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      index: true,
    },
    academicYearLabel: { type: String, required: true, trim: true, index: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cooperation: ratingField,
    commitment: ratingField,
    responseSpeed: ratingField,
    reportQuality: ratingField,
    communication: ratingField,
    notes: { type: String, trim: true, maxlength: 4000 },
    reviewedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

InstitutionSupervisorFeedbackSchema.index(
  { organizationId: 1, academicYearId: 1, supervisorId: 1 },
  { unique: true, sparse: true }
);

const InstitutionSupervisorFeedback: Model<IInstitutionSupervisorFeedback> =
  mongoose.models.InstitutionSupervisorFeedback ||
  mongoose.model<IInstitutionSupervisorFeedback>(
    "InstitutionSupervisorFeedback",
    InstitutionSupervisorFeedbackSchema
  );

export default InstitutionSupervisorFeedback;

import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const ACADEMIC_YEAR_STATUSES = ["draft", "active", "locked", "archived"] as const;
export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUSES)[number];

export interface IAcademicYear extends Document {
  name: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isLocked: boolean;
  promotionExecuted: boolean;
  snapshotCreated: boolean;
  status: AcademicYearStatus;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicYearSchema = new Schema<IAcademicYear>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, index: true },
    label: { type: String, required: true, trim: true, maxlength: 80, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    isCurrent: { type: Boolean, default: false, index: true },
    isLocked: { type: Boolean, default: false, index: true },
    promotionExecuted: { type: Boolean, default: false },
    snapshotCreated: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ACADEMIC_YEAR_STATUSES,
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
  },
  { timestamps: true }
);

AcademicYearSchema.index({ status: 1, isCurrent: 1 });
AcademicYearSchema.index(
  { isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true }, name: "academic_year_one_current" }
);

const AcademicYear: Model<IAcademicYear> =
  mongoose.models.AcademicYear || mongoose.model<IAcademicYear>("AcademicYear", AcademicYearSchema);

export default AcademicYear;

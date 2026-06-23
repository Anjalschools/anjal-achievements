import mongoose, { Document, Model, Schema, Types } from "mongoose";

export const VOLUNTEER_RECORD_STATUSES = ["draft", "submitted", "approved"] as const;
export type VolunteerRecordStatus = (typeof VOLUNTEER_RECORD_STATUSES)[number];

export interface IVolunteerRecord extends Document {
  studentId: Types.ObjectId;
  title: string;
  organization: string;
  description?: string;
  hours: number;
  startDate?: Date;
  endDate?: Date;
  academicYear: string;
  academicYearId?: Types.ObjectId;
  academicYearLabel?: string;
  status: VolunteerRecordStatus;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VolunteerRecordSchema = new Schema<IVolunteerRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    organization: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 4000 },
    hours: { type: Number, required: true, min: 0, max: 10000, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    academicYear: { type: String, required: true, trim: true, maxlength: 80, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", sparse: true, index: true },
    academicYearLabel: { type: String, trim: true, maxlength: 80, sparse: true },
    status: {
      type: String,
      enum: VOLUNTEER_RECORD_STATUSES,
      default: "draft",
      index: true,
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
  },
  { timestamps: true }
);

VolunteerRecordSchema.index({ studentId: 1, academicYear: 1 });

const VolunteerRecord: Model<IVolunteerRecord> =
  mongoose.models.VolunteerRecord ||
  mongoose.model<IVolunteerRecord>("VolunteerRecord", VolunteerRecordSchema);

export default VolunteerRecord;

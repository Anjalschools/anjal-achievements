import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISchoolYear extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  status: "draft" | "active" | "archived";
  isCurrent: boolean;
  archivedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolYearSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    isCurrent: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

SchoolYearSchema.index({ isCurrent: 1, status: 1 });

const SchoolYear: Model<ISchoolYear> =
  mongoose.models.SchoolYear || mongoose.model<ISchoolYear>("SchoolYear", SchoolYearSchema);

export default SchoolYear;

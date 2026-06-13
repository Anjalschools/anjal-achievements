import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAcademicSnapshot extends Document {
  academicYearId: Types.ObjectId;
  studentCount: number;
  achievementCount: number;
  trainingCount: number;
  volunteerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicSnapshotSchema = new Schema<IAcademicSnapshot>(
  {
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    studentCount: { type: Number, default: 0, min: 0 },
    achievementCount: { type: Number, default: 0, min: 0 },
    trainingCount: { type: Number, default: 0, min: 0 },
    volunteerCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

AcademicSnapshotSchema.index({ academicYearId: 1, createdAt: -1 });

const AcademicSnapshot: Model<IAcademicSnapshot> =
  mongoose.models.AcademicSnapshot ||
  mongoose.model<IAcademicSnapshot>("AcademicSnapshot", AcademicSnapshotSchema);

export default AcademicSnapshot;

import mongoose, { Document, Model, Schema } from "mongoose";

export interface IAlumniCohort extends Document {
  graduationYear: number;
  track?: string;
  stage?: string;
  label?: string;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniCohortSchema = new Schema<IAlumniCohort>(
  {
    graduationYear: { type: Number, required: true, min: 1950, max: 2100, index: true },
    track: { type: String, trim: true, maxlength: 80 },
    stage: { type: String, trim: true, maxlength: 80 },
    label: { type: String, trim: true, maxlength: 200 },
    featured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

AlumniCohortSchema.index({ graduationYear: 1, track: 1 }, { unique: false });

const AlumniCohort: Model<IAlumniCohort> =
  mongoose.models.AlumniCohort || mongoose.model<IAlumniCohort>("AlumniCohort", AlumniCohortSchema);

export default AlumniCohort;

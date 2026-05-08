import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniOpportunityType =
  | "mentorship"
  | "internship"
  | "job"
  | "workshop"
  | "speaking"
  | "partnership";

export interface IAlumniOpportunity extends Document {
  title: string;
  description?: string;
  type: AlumniOpportunityType;
  company?: string;
  location?: string;
  remote?: boolean;
  contactEmail?: string;
  applicationUrl?: string;
  createdByUserId?: Types.ObjectId;
  published: boolean;
  featured: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniOpportunitySchema = new Schema<IAlumniOpportunity>(
  {
    title: { type: String, required: true, trim: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 10_000 },
    type: {
      type: String,
      enum: ["mentorship", "internship", "job", "workshop", "speaking", "partnership"],
      required: true,
      index: true,
    },
    company: { type: String, trim: true, maxlength: 200 },
    location: { type: String, trim: true, maxlength: 200 },
    remote: { type: Boolean, default: false, index: true },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 320 },
    applicationUrl: { type: String, trim: true, maxlength: 1000 },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    published: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true }
);

AlumniOpportunitySchema.index({ published: 1, type: 1, remote: 1, createdAt: -1 });
AlumniOpportunitySchema.index({ company: 1, published: 1 });

const AlumniOpportunity: Model<IAlumniOpportunity> =
  mongoose.models.AlumniOpportunity ||
  mongoose.model<IAlumniOpportunity>("AlumniOpportunity", AlumniOpportunitySchema);

export default AlumniOpportunity;

import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniOpportunityType =
  | "mentorship"
  | "internship"
  | "job"
  | "workshop"
  | "speaking"
  | "partnership";

export type AlumniOpportunityReviewEvent = {
  at: Date;
  actorUserId?: Types.ObjectId;
  action: string;
  notes?: string;
};

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
  /** Who submitted (alumni vs admin) — audit. */
  submittedByRole?: "alumni" | "admin" | "system";
  published: boolean;
  /** Moderation lifecycle (alumni-submitted opportunities start as pending_review). */
  reviewStatus?: "pending_review" | "approved" | "rejected" | "archived";
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  /** Append-only moderation / publish trail. */
  reviewTimeline?: AlumniOpportunityReviewEvent[];
  featured: boolean;
  expiresAt?: Date;
  /** When set, hidden from default admin/public listings (archived). */
  archivedAt?: Date | null;
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
    submittedByRole: {
      type: String,
      enum: ["alumni", "admin", "system"],
      required: false,
      index: true,
    },
    published: { type: Boolean, default: false, index: true },
    reviewStatus: {
      type: String,
      enum: ["pending_review", "approved", "rejected", "archived"],
      required: false,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    reviewedAt: { type: Date, sparse: true },
    reviewNotes: { type: String, trim: true, maxlength: 4000 },
    reviewTimeline: {
      type: [
        new Schema(
          {
            at: { type: Date, required: true },
            actorUserId: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
            action: { type: String, required: true, trim: true, maxlength: 160 },
            notes: { type: String, trim: true, maxlength: 4000 },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    featured: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, index: true },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

AlumniOpportunitySchema.index({ published: 1, type: 1, remote: 1, createdAt: -1 });
AlumniOpportunitySchema.index({ company: 1, published: 1 });

const AlumniOpportunity: Model<IAlumniOpportunity> =
  mongoose.models.AlumniOpportunity ||
  mongoose.model<IAlumniOpportunity>("AlumniOpportunity", AlumniOpportunitySchema);

export default AlumniOpportunity;

import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniOnboardingServices = {
  mentoring?: boolean;
  internships?: boolean;
  jobs?: boolean;
  workshops?: boolean;
  judging?: boolean;
  sponsorship?: boolean;
};

export interface IAlumniOnboardingRequest extends Document {
  userId?: Types.ObjectId;
  fullName: string;
  email: string;
  phone?: string;
  graduationYear: number;
  universityName?: string;
  major?: string;
  degree?: string;
  studyCountry?: string;
  currentCompany?: string;
  currentPosition?: string;
  industry?: string;
  linkedinUrl?: string;
  city?: string;
  country?: string;
  bio?: string;
  services?: AlumniOnboardingServices;
  status: "pending" | "approved" | "rejected";
  reviewedById?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniOnboardingServicesSchema = new Schema(
  {
    mentoring: { type: Boolean },
    internships: { type: Boolean },
    jobs: { type: Boolean },
    workshops: { type: Boolean },
    judging: { type: Boolean },
    sponsorship: { type: Boolean },
  },
  { _id: false }
);

const AlumniOnboardingRequestSchema = new Schema<IAlumniOnboardingRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320, index: true },
    phone: { type: String, trim: true, maxlength: 50 },
    graduationYear: { type: Number, required: true, min: 1950, max: 2100 },
    universityName: { type: String, trim: true, maxlength: 200 },
    major: { type: String, trim: true, maxlength: 200 },
    degree: { type: String, trim: true, maxlength: 120 },
    studyCountry: { type: String, trim: true, maxlength: 120 },
    currentCompany: { type: String, trim: true, maxlength: 200 },
    currentPosition: { type: String, trim: true, maxlength: 200 },
    industry: { type: String, trim: true, maxlength: 120 },
    linkedinUrl: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120 },
    country: { type: String, trim: true, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 4000 },
    services: { type: AlumniOnboardingServicesSchema, default: undefined },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedById: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

AlumniOnboardingRequestSchema.index({ status: 1, createdAt: -1 });
AlumniOnboardingRequestSchema.index({ email: 1, status: 1 });
AlumniOnboardingRequestSchema.index({ userId: 1, status: 1 }, { sparse: true });

const AlumniOnboardingRequest: Model<IAlumniOnboardingRequest> =
  mongoose.models.AlumniOnboardingRequest ||
  mongoose.model<IAlumniOnboardingRequest>("AlumniOnboardingRequest", AlumniOnboardingRequestSchema);

export default AlumniOnboardingRequest;

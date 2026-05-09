import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { AlumniPrivacySettings } from "@/models/alumni-privacy-types";

/** Optional alumni extension (Phase 1 — all sub-fields optional). */
export type AlumniServices = {
  mentoring?: boolean;
  internships?: boolean;
  jobs?: boolean;
  workshops?: boolean;
  judging?: boolean;
  sponsorship?: boolean;
};

export type AlumniVerificationSource = "linkedin" | "admin" | "university_email" | "career";

export type AlumniProfile = {
  graduationYear?: number;
  /** Year of admission to higher education (post–secondary). */
  universityAdmissionYear?: number;
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
  isFeaturedAlumni?: boolean;
  isVerifiedAlumni?: boolean;
  /** Phase 4 — optional verification audit trail */
  verifiedAt?: Date;
  verifiedById?: Types.ObjectId;
  verificationSource?: AlumniVerificationSource;
  /** Cached 0–1000; recomputed via admin reputation API */
  reputationScore?: number;
  /** Interest tags for smart matching (optional, max 10 in schema) */
  interests?: string[];
  /** Prestige flags (optional) */
  isAmbassadorAlumni?: boolean;
  isDistinguishedAlumni?: boolean;
  alumniServices?: AlumniServices;
  /** Phase 6 — alumni-controlled visibility (optional; defaults = open in app layer). */
  privacySettings?: AlumniPrivacySettings;
  /** Phase 4 — verified ecosystem tier (admin / verification center). */
  verificationTier?: "basic" | "academic" | "career" | "institution" | "global";
  /** Phase 4 — composite trust 0–100 (reputation + verification + activity). */
  trustScore?: number;
  /** Alumni onboarding / activation lifecycle (optional; legacy rows omit). */
  alumniActivationStatus?:
    | "pending"
    | "created_new"
    | "linked_existing"
    | "activation_sent"
    | "promoted_from_student"
    | "onboarding_required"
    | "active"
    | "failed";
};

export interface IUser extends Document {
  fullName: string; // Keep for backward compatibility
  fullNameAr?: string; // Arabic name
  fullNameEn?: string; // English name
  firstName?: string;
  fatherName?: string;
  grandfatherName?: string;
  lastName?: string;
  email: string;
  username: string;
  studentId: string;
  nationalId?: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianNationalId?: string;
  passwordHash: string;
  profilePhoto?: string;
  gender: "male" | "female";
  section: "arabic" | "international";
  grade: string;
  /** Student: enrolled in Mawhiba (gifted) program classes. Omitted/false for legacy accounts. */
  isMawhibaStudent?: boolean;
  role: "student" | "admin" | "teacher" | "supervisor" | "judge" | "schoolAdmin";
  status: "active" | "inactive" | "suspended";
  preferredLanguage: "ar" | "en";
  /** Set on successful login (optional for legacy rows). */
  lastLoginAt?: Date;
  /** When true, user must change password (e.g. first login after alumni activation). */
  mustChangePassword?: boolean;
  /** Public achievement portfolio (slug + secret token). */
  publicPortfolioEnabled?: boolean;
  publicPortfolioSlug?: string;
  publicPortfolioToken?: string;
  publicPortfolioPublishedAt?: Date;
  /** In-app / email notification toggles (optional for legacy documents). */
  notificationPreferences?: {
    news?: boolean;
    review?: boolean;
    system?: boolean;
    email?: boolean;
  };
  /** Visibility preferences within the platform (optional for legacy documents). */
  privacyPreferences?: {
    showNameInSystem?: boolean;
    showEmailToSupervisors?: boolean;
    showProfileInAdminPanel?: boolean;
  };
  /**
   * Optional organizational scope for staff (admin / supervisor / schoolAdmin / teacher / judge).
   * When set with at least one dimension, access is limited to students matching these dimensions (union within each axis).
   * Admin/supervisor: omit or leave empty → platform-wide; set → restricted to scope.
   * schoolAdmin/teacher/judge: omit empty arrays → fallback to the account’s own gender/section/grade.
   */
  staffScope?: {
    genders?: ("male" | "female")[];
    sections?: ("arabic" | "international")[];
    grades?: string[];
  };
  /** Optional per-user permission overrides/additions. */
  permissions?: string[];
  /** Rich text/blocks for the public achievement portfolio page (student-edited). */
  studentPortfolioContent?: {
    bio?: string;
    technicalSkills?: string[];
    personalSkills?: string[];
    courses?: Array<{
      title?: string;
      provider?: string;
      type?: string;
      trainingHours?: number;
      date?: string;
      url?: string;
    }>;
    activities?: Array<{
      title?: string;
      type?: string;
      organization?: string;
      description?: string;
      hours?: number;
      date?: string;
    }>;
    portfolioContact?: {
      showEmail?: boolean;
      showPhone?: boolean;
    };
  };
  /** Student vs alumni classification; omitted → student (see {@link getAccountType}). */
  accountType?: "student" | "alumni";
  /** Optional alumni résumé / visibility fields (Phase 1). */
  alumniProfile?: AlumniProfile;
  /** After g12 promotion: user must complete post-grad alumni onboarding (optional; legacy rows omit). */
  needsAlumniOnboarding?: boolean;
  completedAlumniOnboardingAt?: Date;
  /** Admin soft-remove from alumni community listings (user doc retained). */
  alumniCommunityRemovedAt?: Date;
  alumniCommunityRemovedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioCourseSchema = new Schema(
  {
    title: { type: String, trim: true },
    provider: { type: String, trim: true },
    type: { type: String, trim: true },
    trainingHours: { type: Number, min: 0 },
    date: { type: String, trim: true },
    url: { type: String, trim: true },
  },
  { _id: false }
);

const PortfolioActivitySchema = new Schema(
  {
    title: { type: String, trim: true },
    type: { type: String, trim: true },
    organization: { type: String, trim: true },
    description: { type: String, trim: true },
    hours: { type: Number, min: 0 },
    date: { type: String, trim: true },
  },
  { _id: false }
);

const StudentPortfolioContentSchema = new Schema(
  {
    bio: { type: String, trim: true, maxlength: 4000, default: "" },
    technicalSkills: [{ type: String, trim: true, maxlength: 120 }],
    personalSkills: [{ type: String, trim: true, maxlength: 120 }],
    courses: [PortfolioCourseSchema],
    activities: [PortfolioActivitySchema],
    portfolioContact: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const AlumniServicesSchema = new Schema(
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

const AlumniPrivacySettingsSchema = new Schema(
  {
    publicProfile: { type: Boolean },
    searchable: { type: Boolean },
    showEmail: { type: Boolean },
    showLinkedIn: { type: Boolean },
    showCompany: { type: Boolean },
    allowMentorshipRequests: { type: Boolean },
  },
  { _id: false }
);

const AlumniProfileSchema = new Schema(
  {
    graduationYear: { type: Number, min: 1950, max: 2100 },
    universityAdmissionYear: { type: Number, min: 1950, max: 2100 },
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
    isFeaturedAlumni: { type: Boolean },
    isVerifiedAlumni: { type: Boolean },
    verifiedAt: { type: Date },
    verifiedById: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    verificationSource: {
      type: String,
      enum: ["linkedin", "admin", "university_email", "career"],
      required: false,
    },
    reputationScore: { type: Number, min: 0, max: 10_000, sparse: true },
    interests: [{ type: String, trim: true, maxlength: 80 }],
    isAmbassadorAlumni: { type: Boolean, sparse: true },
    isDistinguishedAlumni: { type: Boolean, sparse: true },
    alumniServices: { type: AlumniServicesSchema, default: undefined },
    privacySettings: { type: AlumniPrivacySettingsSchema, default: undefined },
    verificationTier: {
      type: String,
      enum: ["basic", "academic", "career", "institution", "global"],
      required: false,
      sparse: true,
    },
    trustScore: { type: Number, min: 0, max: 100, sparse: true },
    alumniActivationStatus: {
      type: String,
      enum: [
        "pending",
        "created_new",
        "linked_existing",
        "activation_sent",
        "promoted_from_student",
        "onboarding_required",
        "active",
        "failed",
      ],
      required: false,
    },
  },
  { _id: false }
);

const UserSchema: Schema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    fullNameAr: {
      type: String,
      trim: true,
    },
    fullNameEn: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    fatherName: {
      type: String,
      trim: true,
    },
    grandfatherName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nationalId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    guardianName: {
      type: String,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
    },
    guardianNationalId: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    profilePhoto: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    section: {
      type: String,
      enum: ["arabic", "international"],
      required: true,
    },
    grade: {
      type: String,
      required: true,
    },
    isMawhibaStudent: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["student", "admin", "teacher", "supervisor", "judge", "schoolAdmin"],
      default: "student",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    preferredLanguage: {
      type: String,
      enum: ["ar", "en"],
      default: "ar",
    },
    lastLoginAt: {
      type: Date,
      required: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    publicPortfolioEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    publicPortfolioSlug: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
      index: true,
    },
    publicPortfolioToken: {
      type: String,
      trim: true,
      select: false,
    },
    publicPortfolioPublishedAt: {
      type: Date,
    },
    notificationPreferences: {
      news: { type: Boolean, default: true },
      review: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
    privacyPreferences: {
      showNameInSystem: { type: Boolean, default: true },
      showEmailToSupervisors: { type: Boolean, default: true },
      showProfileInAdminPanel: { type: Boolean, default: true },
    },
    staffScope: {
      genders: [{ type: String, enum: ["male", "female"] }],
      sections: [{ type: String, enum: ["arabic", "international"] }],
      grades: [{ type: String, trim: true }],
    },
    permissions: [{ type: String, trim: true }],
    studentPortfolioContent: {
      type: StudentPortfolioContentSchema,
      default: undefined,
    },
    accountType: {
      type: String,
      enum: ["student", "alumni"],
      required: false,
    },
    alumniProfile: {
      type: AlumniProfileSchema,
      default: undefined,
    },
    needsAlumniOnboarding: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAlumniOnboardingAt: {
      type: Date,
      required: false,
    },
    alumniCommunityRemovedAt: {
      type: Date,
      required: false,
    },
    alumniCommunityRemovedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ publicPortfolioEnabled: 1, publicPortfolioSlug: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ accountType: 1 }, { sparse: true });
UserSchema.index({ "alumniProfile.isFeaturedAlumni": 1 }, { sparse: true });
UserSchema.index({ "alumniProfile.universityName": 1 }, { sparse: true });
UserSchema.index({ "alumniProfile.industry": 1 }, { sparse: true });
UserSchema.index({ "alumniProfile.reputationScore": -1 }, { sparse: true });
UserSchema.index({ "alumniProfile.isVerifiedAlumni": 1 }, { sparse: true });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;

import mongoose, { Schema, Document, Model } from "mongoose";

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
  role: "student" | "admin" | "teacher" | "supervisor" | "judge" | "schoolAdmin";
  status: "active" | "inactive" | "suspended";
  preferredLanguage: "ar" | "en";
  /** Set on successful login (optional for legacy rows). */
  lastLoginAt?: Date;
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
   * Optional organizational scope for staff (schoolAdmin / teacher / judge).
   * When set, achievement/report access is limited to students matching these dimensions.
   * If omitted, the account’s own gender / section / grade are used as a single assignment.
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
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ publicPortfolioEnabled: 1, publicPortfolioSlug: 1 });
UserSchema.index({ role: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;

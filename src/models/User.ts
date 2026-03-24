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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ publicPortfolioEnabled: 1, publicPortfolioSlug: 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;

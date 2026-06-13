import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type CareerPublicVisibility = {
  showAchievements: boolean;
  showTraining: boolean;
  showVolunteer: boolean;
  showResume: boolean;
};

export interface IStudentCareerProfile extends Document {
  studentId: Types.ObjectId;
  professionalBio: string;
  professionalBioEn: string;
  careerInterests: string[];
  targetMajors: string[];
  manualSkills: string[];
  extractedSkills: string[];
  careerReadinessScore: number;
  universityReadinessScore: number;
  volunteerHours: number;
  trainingHours: number;
  achievementsScore: number;
  leadershipScore: number;
  skillsScore: number;
  publicVisibility: CareerPublicVisibility;
  careerInsight?: string;
  universityInsight?: string;
  skillGapAnalysis?: string;
  scoresComputedAt?: Date;
  academicYearId?: Types.ObjectId;
  academicYear?: string;
  academicYearLabel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PublicVisibilitySchema = new Schema<CareerPublicVisibility>(
  {
    showAchievements: { type: Boolean, default: true },
    showTraining: { type: Boolean, default: false },
    showVolunteer: { type: Boolean, default: false },
    showResume: { type: Boolean, default: false },
  },
  { _id: false }
);

const StudentCareerProfileSchema = new Schema<IStudentCareerProfile>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    professionalBio: { type: String, trim: true, maxlength: 6000, default: "" },
    professionalBioEn: { type: String, trim: true, maxlength: 6000, default: "" },
    careerInterests: { type: [String], default: [] },
    targetMajors: { type: [String], default: [] },
    manualSkills: { type: [String], default: [] },
    extractedSkills: { type: [String], default: [] },
    careerReadinessScore: { type: Number, min: 0, max: 100, default: 0 },
    universityReadinessScore: { type: Number, min: 0, max: 100, default: 0 },
    volunteerHours: { type: Number, min: 0, default: 0 },
    trainingHours: { type: Number, min: 0, default: 0 },
    achievementsScore: { type: Number, min: 0, max: 100, default: 0 },
    leadershipScore: { type: Number, min: 0, max: 100, default: 0 },
    skillsScore: { type: Number, min: 0, max: 100, default: 0 },
    publicVisibility: { type: PublicVisibilitySchema, default: () => ({}) },
    careerInsight: { type: String, trim: true, maxlength: 8000 },
    universityInsight: { type: String, trim: true, maxlength: 8000 },
    skillGapAnalysis: { type: String, trim: true, maxlength: 8000 },
    scoresComputedAt: { type: Date },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", sparse: true, index: true },
    academicYear: { type: String, trim: true, maxlength: 80, sparse: true },
    academicYearLabel: { type: String, trim: true, maxlength: 80, sparse: true },
  },
  { timestamps: true }
);

const StudentCareerProfile: Model<IStudentCareerProfile> =
  mongoose.models.StudentCareerProfile ||
  mongoose.model<IStudentCareerProfile>("StudentCareerProfile", StudentCareerProfileSchema);

export default StudentCareerProfile;

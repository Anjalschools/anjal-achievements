import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { TRAINING_COMPLETION_STATUSES } from "@/lib/partnerships/training-completion-constants";
import type {
  InstitutionReportReviewStatus,
  InstitutionReportRiskFlag,
  InstitutionReportSource,
  InstitutionReportValidationResult,
} from "@/lib/partnerships/institution-final-report-constants";

export type InstitutionUploadedEvaluation = {
  supervisorName?: string;
  contactNumber?: string;
  positionTitle?: string;
  attendanceRating?: number;
  disciplineRating?: number;
  ethicsRating?: number;
  communicationRating?: number;
  teamworkRating?: number;
  initiativeRating?: number;
  technicalSkillsRating?: number;
  problemSolvingRating?: number;
  taskExecutionRating?: number;
  safetyRating?: number;
  assignedTasks?: string;
  achievements?: string;
  strengths?: string;
  improvementAreas?: string;
  recommendation?: string;
};

export type InstitutionReportExtractionMeta = {
  confidenceScore: number;
  hasSignature: boolean;
  hasStamp: boolean;
  extractedAt: Date;
  extractionMethod?: string;
  ocrTextPreview?: string;
  fieldsExtracted?: Record<string, unknown>;
  populatedFields?: string[];
  skippedFields?: string[];
  validationResult?: InstitutionReportValidationResult;
  reviewStatus?: InstitutionReportReviewStatus;
  riskFlags?: InstitutionReportRiskFlag[];
};

export interface ITrainingCompletionRecord extends Document {
  applicationId: Types.ObjectId;
  studentId: Types.ObjectId;
  organizationId: Types.ObjectId;
  academicYear: string;
  status: (typeof TRAINING_COMPLETION_STATUSES)[number];
  organizationName?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  volunteerHours?: number;
  hasAllowance?: boolean;
  studentBenefitRating?: number;
  numberOfTrainees?: number;
  positionTitle?: string;
  assignedTasks?: string;
  studentReflection?: string;
  supervisorCooperationRating?: number;
  practicalBenefitRating?: number;
  workEnvironmentRating?: number;
  recommendInstitutionToPeers?: boolean;
  biggestChallenge?: string;
  challengeResponse?: string;
  wishedToLearn?: string;
  futureImpact?: string;
  attendanceCommitment?: number;
  professionalEthics?: number;
  safetyCompliance?: number;
  overallRecommendation?: number;
  institutionNotes?: string;
  institutionReportSource?: InstitutionReportSource;
  institutionReportFileKey?: string;
  institutionReportFileName?: string;
  institutionReportExtraction?: InstitutionReportExtractionMeta;
  institutionUploadedEvaluation?: InstitutionUploadedEvaluation;
  videoUrl?: string;
  reviewNotes?: string;
  revisionRequestedAt?: Date;
  revisionRequestedBy?: Types.ObjectId;
  revisionReason?: string;
  resubmittedAt?: Date;
  revisionAudit?: Array<{
    at: Date;
    action: string;
    actorId?: string;
    actorName?: string;
    reason?: string;
    fromStatus?: string;
    toStatus?: string;
  }>;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  submittedAt?: Date;
  achievementId?: Types.ObjectId;
  automationCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingCompletionRecordSchema = new Schema<ITrainingCompletionRecord>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      unique: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    academicYear: { type: String, required: true, trim: true, maxlength: 80, index: true },
    status: {
      type: String,
      enum: TRAINING_COMPLETION_STATUSES,
      required: true,
      default: "pending",
    },
    organizationName: { type: String, trim: true, maxlength: 220 },
    supervisorName: { type: String, trim: true, maxlength: 200 },
    supervisorPhone: { type: String, trim: true, maxlength: 40 },
    trainingStartDate: { type: Date },
    trainingEndDate: { type: Date },
    volunteerHours: { type: Number, min: 0, max: 10000 },
    hasAllowance: { type: Boolean },
    studentBenefitRating: { type: Number, min: 1, max: 5, default: 5 },
    numberOfTrainees: { type: Number, min: 0, max: 5000 },
    positionTitle: { type: String, trim: true, maxlength: 300 },
    assignedTasks: { type: String, trim: true, maxlength: 8000 },
    studentReflection: { type: String, trim: true, maxlength: 8000 },
    supervisorCooperationRating: { type: Number, min: 1, max: 5 },
    practicalBenefitRating: { type: Number, min: 1, max: 5 },
    workEnvironmentRating: { type: Number, min: 1, max: 5 },
    recommendInstitutionToPeers: { type: Boolean },
    biggestChallenge: { type: String, trim: true, maxlength: 4000 },
    challengeResponse: { type: String, trim: true, maxlength: 4000 },
    wishedToLearn: { type: String, trim: true, maxlength: 4000 },
    futureImpact: { type: String, trim: true, maxlength: 4000 },
    attendanceCommitment: { type: Number, min: 1, max: 5 },
    professionalEthics: { type: Number, min: 1, max: 5 },
    safetyCompliance: { type: Number, min: 1, max: 5 },
    overallRecommendation: { type: Number, min: 1, max: 5 },
    institutionNotes: { type: String, trim: true, maxlength: 4000 },
    institutionReportSource: {
      type: String,
      enum: ["portal", "uploaded_pdf", "uploaded_scan"],
      sparse: true,
      index: true,
    },
    institutionReportFileKey: { type: String, trim: true, maxlength: 2000 },
    institutionReportFileName: { type: String, trim: true, maxlength: 300 },
    institutionReportExtraction: { type: Schema.Types.Mixed },
    institutionUploadedEvaluation: { type: Schema.Types.Mixed },
    videoUrl: { type: String, trim: true, maxlength: 2000 },
    reviewNotes: { type: String, trim: true, maxlength: 4000 },
    revisionRequestedAt: { type: Date },
    revisionRequestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    revisionReason: { type: String, trim: true, maxlength: 4000 },
    resubmittedAt: { type: Date },
    revisionAudit: [
      {
        at: { type: Date, required: true },
        action: { type: String, required: true, trim: true, maxlength: 80 },
        actorId: { type: String, trim: true, maxlength: 40 },
        actorName: { type: String, trim: true, maxlength: 200 },
        reason: { type: String, trim: true, maxlength: 4000 },
        fromStatus: { type: String, trim: true, maxlength: 40 },
        toStatus: { type: String, trim: true, maxlength: 40 },
      },
    ],
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, index: true },
    achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", sparse: true, index: true },
    automationCompletedAt: { type: Date },
  },
  { timestamps: true }
);

TrainingCompletionRecordSchema.index({ status: 1, submittedAt: -1 });
TrainingCompletionRecordSchema.index({ studentId: 1, academicYear: 1 });

const TrainingCompletionRecord: Model<ITrainingCompletionRecord> =
  mongoose.models.TrainingCompletionRecord ||
  mongoose.model<ITrainingCompletionRecord>("TrainingCompletionRecord", TrainingCompletionRecordSchema);

export default TrainingCompletionRecord;

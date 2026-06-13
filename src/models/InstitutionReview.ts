import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { INSTITUTION_DECISION_STATUSES } from "@/lib/partnerships/partnerships-messaging-constants";
import {
  INSTITUTION_FINAL_RECOMMENDATIONS,
  INSTITUTION_REVIEW_KINDS,
} from "@/lib/partnerships/institution-experience-constants";

export interface IInstitutionReview extends Document {
  applicationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  decision: (typeof INSTITUTION_DECISION_STATUSES)[number];
  reviewKind?: (typeof INSTITUTION_REVIEW_KINDS)[number];
  notes?: string;
  reviewedAt: Date;
  commitment?: number;
  attendance?: number;
  discipline?: number;
  communication?: number;
  teamwork?: number;
  technicalSkills?: number;
  professionalSkills?: number;
  strengths?: string;
  improvementAreas?: string;
  finalRecommendation?: (typeof INSTITUTION_FINAL_RECOMMENDATIONS)[number];
  institutionNotes?: string;
  overallRating?: number;
  trainingQualityRating?: number;
  supervisionRating?: number;
  workEnvironmentRating?: number;
  benefitRating?: number;
  wouldRecommend?: boolean;
  studentFeedbackNotes?: string;
  studentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionReviewSchema = new Schema<IInstitutionReview>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: "StudentTrainingApplication", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    decision: { type: String, enum: INSTITUTION_DECISION_STATUSES, required: true, index: true },
    reviewKind: { type: String, enum: INSTITUTION_REVIEW_KINDS, default: "decision", index: true },
    notes: { type: String, trim: true, maxlength: 4000 },
    reviewedAt: { type: Date, required: true, index: true },
    commitment: { type: Number, min: 1, max: 5 },
    attendance: { type: Number, min: 1, max: 5 },
    discipline: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    teamwork: { type: Number, min: 1, max: 5 },
    technicalSkills: { type: Number, min: 1, max: 5 },
    professionalSkills: { type: Number, min: 1, max: 5 },
    strengths: { type: String, trim: true, maxlength: 4000 },
    improvementAreas: { type: String, trim: true, maxlength: 4000 },
    finalRecommendation: { type: String, enum: INSTITUTION_FINAL_RECOMMENDATIONS },
    institutionNotes: { type: String, trim: true, maxlength: 4000 },
    overallRating: { type: Number, min: 1, max: 5 },
    trainingQualityRating: { type: Number, min: 1, max: 5 },
    supervisionRating: { type: Number, min: 1, max: 5 },
    workEnvironmentRating: { type: Number, min: 1, max: 5 },
    benefitRating: { type: Number, min: 1, max: 5 },
    wouldRecommend: { type: Boolean },
    studentFeedbackNotes: { type: String, trim: true, maxlength: 4000 },
    studentId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

InstitutionReviewSchema.index({ applicationId: 1, reviewedAt: -1 });
InstitutionReviewSchema.index({ organizationId: 1, reviewedAt: -1 });

const InstitutionReview: Model<IInstitutionReview> =
  mongoose.models.InstitutionReview ||
  mongoose.model<IInstitutionReview>("InstitutionReview", InstitutionReviewSchema);

export default InstitutionReview;

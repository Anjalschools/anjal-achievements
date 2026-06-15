import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  ANNUAL_REVIEW_RENEWAL_DECISIONS,
  type AnnualReviewRenewalDecision,
} from "@/lib/partnerships/institution-performance-intelligence-constants";

export interface IInstitutionAnnualReview extends Document {
  organizationId: Types.ObjectId;
  academicYearId?: Types.ObjectId;
  academicYearLabel: string;
  snapshotId?: Types.ObjectId;
  performanceSummaryAr: string;
  performanceSummaryEn: string;
  achievementsAr: string;
  achievementsEn: string;
  statisticsAr: string;
  statisticsEn: string;
  recommendationsAr: string;
  recommendationsEn: string;
  renewalDecision: AnnualReviewRenewalDecision;
  generatedAt: Date;
  generatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionAnnualReviewSchema = new Schema<IInstitutionAnnualReview>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerOrganization",
      required: true,
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      index: true,
    },
    academicYearLabel: { type: String, required: true, trim: true, index: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "InstitutionPerformanceSnapshot" },
    performanceSummaryAr: { type: String, default: "", maxlength: 8000 },
    performanceSummaryEn: { type: String, default: "", maxlength: 8000 },
    achievementsAr: { type: String, default: "", maxlength: 8000 },
    achievementsEn: { type: String, default: "", maxlength: 8000 },
    statisticsAr: { type: String, default: "", maxlength: 8000 },
    statisticsEn: { type: String, default: "", maxlength: 8000 },
    recommendationsAr: { type: String, default: "", maxlength: 8000 },
    recommendationsEn: { type: String, default: "", maxlength: 8000 },
    renewalDecision: {
      type: String,
      enum: ANNUAL_REVIEW_RENEWAL_DECISIONS,
      default: "review_next_year",
      index: true,
    },
    generatedAt: { type: Date, required: true, index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

InstitutionAnnualReviewSchema.index(
  { organizationId: 1, academicYearId: 1 },
  { unique: true, sparse: true }
);

const InstitutionAnnualReview: Model<IInstitutionAnnualReview> =
  mongoose.models.InstitutionAnnualReview ||
  mongoose.model<IInstitutionAnnualReview>("InstitutionAnnualReview", InstitutionAnnualReviewSchema);

export default InstitutionAnnualReview;

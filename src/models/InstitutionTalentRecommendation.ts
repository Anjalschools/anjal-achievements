import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  TALENT_RECOMMENDATION_LEVELS,
  type TalentRecommendationLevel,
} from "@/lib/partnerships/training-outcome-constants";

export interface IInstitutionTalentRecommendation extends Document {
  studentId: Types.ObjectId;
  institutionId: Types.ObjectId;
  applicationId: Types.ObjectId;
  outcomeRecordId?: Types.ObjectId;
  recommendationDate: Date;
  recommendationLevel: TalentRecommendationLevel;
  supervisorComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionTalentRecommendationSchema = new Schema<IInstitutionTalentRecommendation>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      unique: true,
    },
    outcomeRecordId: { type: Schema.Types.ObjectId, ref: "TrainingOutcomeRecord", sparse: true, index: true },
    recommendationDate: { type: Date, required: true, index: true },
    recommendationLevel: { type: String, enum: TALENT_RECOMMENDATION_LEVELS, required: true },
    supervisorComment: { type: String, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

InstitutionTalentRecommendationSchema.index({ institutionId: 1, recommendationDate: -1 });

const InstitutionTalentRecommendation: Model<IInstitutionTalentRecommendation> =
  mongoose.models.InstitutionTalentRecommendation ||
  mongoose.model<IInstitutionTalentRecommendation>(
    "InstitutionTalentRecommendation",
    InstitutionTalentRecommendationSchema
  );

export default InstitutionTalentRecommendation;

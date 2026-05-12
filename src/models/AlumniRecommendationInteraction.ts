import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type RecommendationInteractionSurface = "recommendations_v1" | "feed" | "mentor_match";
export type RecommendationInteractionAction = "expose" | "click" | "dismiss" | "accept";

export interface IAlumniRecommendationInteraction extends Document {
  userId: Types.ObjectId;
  surface: RecommendationInteractionSurface;
  kind: string;
  targetId: string;
  action: RecommendationInteractionAction;
  createdAt: Date;
}

const AlumniRecommendationInteractionSchema = new Schema<IAlumniRecommendationInteraction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    surface: { type: String, required: true, trim: true, maxlength: 32, index: true },
    kind: { type: String, required: true, trim: true, maxlength: 48, index: true },
    targetId: { type: String, required: true, trim: true, maxlength: 80, index: true },
    action: {
      type: String,
      enum: ["expose", "click", "dismiss", "accept"],
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AlumniRecommendationInteractionSchema.index({ surface: 1, kind: 1, action: 1, createdAt: -1 });

const AlumniRecommendationInteraction: Model<IAlumniRecommendationInteraction> =
  mongoose.models.AlumniRecommendationInteraction ||
  mongoose.model<IAlumniRecommendationInteraction>(
    "AlumniRecommendationInteraction",
    AlumniRecommendationInteractionSchema
  );

export default AlumniRecommendationInteraction;

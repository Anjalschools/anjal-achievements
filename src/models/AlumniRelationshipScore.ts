import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniCrmSegment =
  | "Highly Engaged"
  | "Strategic Alumni"
  | "Potential Mentor"
  | "Potential Sponsor"
  | "Dormant Alumni"
  | "Elite Alumni";

export interface IAlumniRelationshipScore extends Document {
  userId: Types.ObjectId;
  score: number;
  segment: AlumniCrmSegment;
  breakdown: Record<string, number>;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniRelationshipScoreSchema = new Schema<IAlumniRelationshipScore>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    score: { type: Number, required: true, min: 0, max: 1000, index: true },
    segment: {
      type: String,
      enum: [
        "Highly Engaged",
        "Strategic Alumni",
        "Potential Mentor",
        "Potential Sponsor",
        "Dormant Alumni",
        "Elite Alumni",
      ],
      required: true,
      index: true,
    },
    breakdown: { type: Schema.Types.Mixed, default: {} },
    computedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

const AlumniRelationshipScore: Model<IAlumniRelationshipScore> =
  mongoose.models.AlumniRelationshipScore ||
  mongoose.model<IAlumniRelationshipScore>("AlumniRelationshipScore", AlumniRelationshipScoreSchema);

export default AlumniRelationshipScore;

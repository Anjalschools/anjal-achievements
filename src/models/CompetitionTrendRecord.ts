import mongoose, { Document, Model, Schema } from "mongoose";

/** Persisted year-over-year competition trend row (avoids recomputing heavy historical years). */
export interface ICompetitionTrendRecord extends Document {
  academicYear: number;
  records: number;
  distinctStudents: number;
  goldMedals: number;
  silverMedals: number;
  bronzeMedals: number;
  totalMedals: number;
  internationalParticipants: number;
  mawhibaParticipants: number;
  divisionPerformance: Array<{ key: string; records: number; medals: number }>;
  schoolPerformance: Array<{ key: string; records: number; medals: number }>;
  aggregationVersion: number;
  snapshotRef?: string;
  computedAt: Date;
  createdAt: Date;
}

const CompetitionTrendRecordSchema = new Schema<ICompetitionTrendRecord>(
  {
    academicYear: { type: Number, required: true, unique: true, index: true },
    records: { type: Number, default: 0 },
    distinctStudents: { type: Number, default: 0 },
    goldMedals: { type: Number, default: 0 },
    silverMedals: { type: Number, default: 0 },
    bronzeMedals: { type: Number, default: 0 },
    totalMedals: { type: Number, default: 0 },
    internationalParticipants: { type: Number, default: 0 },
    mawhibaParticipants: { type: Number, default: 0 },
    divisionPerformance: {
      type: [{ key: String, records: Number, medals: Number }],
      default: [],
    },
    schoolPerformance: {
      type: [{ key: String, records: Number, medals: Number }],
      default: [],
    },
    aggregationVersion: { type: Number, default: 1 },
    snapshotRef: { type: String },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CompetitionTrendRecord: Model<ICompetitionTrendRecord> =
  mongoose.models.CompetitionTrendRecord ||
  mongoose.model<ICompetitionTrendRecord>("CompetitionTrendRecord", CompetitionTrendRecordSchema);

export default CompetitionTrendRecord;

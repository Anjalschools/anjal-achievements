import mongoose, { type Model, Schema } from "mongoose";

export const SYSTEM_STATS_HOME_ID = "home";

export interface ISystemStats {
  _id: string;
  studentsCount: number;
  achievementsCount: number;
  fieldsCount: number;
  updatedAt: Date;
  createdAt: Date;
}

const SystemStatsSchema = new Schema<ISystemStats>(
  {
    _id: { type: String, required: true },
    studentsCount: { type: Number, required: true, default: 0 },
    achievementsCount: { type: Number, required: true, default: 0 },
    fieldsCount: { type: Number, required: true, default: 0 },
  },
  {
    collection: "systemstats",
    timestamps: true,
  }
);

const SystemStats: Model<ISystemStats> =
  mongoose.models.SystemStats || mongoose.model<ISystemStats>("SystemStats", SystemStatsSchema);

export default SystemStats;

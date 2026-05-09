import AlumniAnalyticsSnapshot from "@/models/AlumniAnalyticsSnapshot";
import type { AlumniSnapshotGranularity } from "@/models/AlumniAnalyticsSnapshot";

export const listAlumniSnapshots = async (granularity: AlumniSnapshotGranularity, limit = 90) => {
  const rows = await AlumniAnalyticsSnapshot.find({ granularity })
    .sort({ periodStart: -1 })
    .limit(limit)
    .lean();
  return rows;
};

export const getLatestAlumniSnapshot = async (granularity: AlumniSnapshotGranularity) => {
  const row = await AlumniAnalyticsSnapshot.findOne({ granularity }).sort({ periodStart: -1 }).lean();
  return row;
};

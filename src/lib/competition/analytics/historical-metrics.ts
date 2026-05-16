import "server-only";
import connectDB from "@/lib/mongodb";
import CompetitionAnalyticsSnapshot from "@/models/CompetitionAnalyticsSnapshot";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";

export const listCompetitionSnapshots = async (
  granularity: CompetitionSnapshotGranularity,
  limit = 90
) => {
  await connectDB();
  return CompetitionAnalyticsSnapshot.find({ granularity })
    .sort({ periodStart: -1 })
    .limit(limit)
    .lean();
};

export const getLatestCompetitionSnapshot = async (granularity: CompetitionSnapshotGranularity) => {
  await connectDB();
  return CompetitionAnalyticsSnapshot.findOne({ granularity }).sort({ periodStart: -1 }).lean();
};

export const getCompetitionSnapshotById = async (id: string) => {
  await connectDB();
  if (!id?.trim()) return null;
  return CompetitionAnalyticsSnapshot.findById(id).lean();
};

export const getCompetitionSnapshotAtPeriod = async (
  granularity: CompetitionSnapshotGranularity,
  periodStart: Date
) => {
  await connectDB();
  return CompetitionAnalyticsSnapshot.findOne({ granularity, periodStart }).lean();
};

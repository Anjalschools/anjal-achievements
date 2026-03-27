import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Achievement from "@/models/Achievement";
import SystemStats, { SYSTEM_STATS_HOME_ID } from "@/models/SystemStats";
import { invalidateHomeStatsCache } from "@/lib/home-stats-response-cache";

const studentMatch = { role: { $in: ["student", "Student"] } } as const;

const fieldsCountPipeline = [
  {
    $match: {
      $and: [
        { inferredField: { $exists: true } },
        { inferredField: { $ne: null } },
        { inferredField: { $ne: "" } },
      ],
    },
  },
  { $group: { _id: "$inferredField" } },
  { $count: "c" },
];

export type HomeStatsSnapshot = {
  studentsCount: number;
  achievementsCount: number;
  fieldsCount: number;
};

export const computeHomeStatsSnapshot = async (): Promise<HomeStatsSnapshot> => {
  await connectDB();

  const [studentsCount, achievementsCount, fieldsAgg] = await Promise.all([
    User.countDocuments(studentMatch),
    Achievement.countDocuments({}),
    Achievement.aggregate<{ c?: number }>(fieldsCountPipeline)
      .option({ maxTimeMS: 10_000, allowDiskUse: false })
      .exec(),
  ]);

  return {
    studentsCount,
    achievementsCount,
    fieldsCount: fieldsAgg[0]?.c ?? 0,
  };
};

/**
 * Recomputes homepage counters and persists them for fast public reads.
 * (Heavy queries live here only — not in /api/public/home-stats.)
 */
export const updateHomeStats = async (): Promise<void> => {
  const snapshot = await computeHomeStatsSnapshot();
  await SystemStats.findOneAndUpdate(
    { _id: SYSTEM_STATS_HOME_ID },
    {
      $set: {
        studentsCount: snapshot.studentsCount,
        achievementsCount: snapshot.achievementsCount,
        fieldsCount: snapshot.fieldsCount,
      },
    },
    { upsert: true, new: true }
  ).lean();

  invalidateHomeStatsCache();
};

/**
 * Non-blocking refresh after writes that affect counts.
 */
export const queueHomeStatsRefresh = (): void => {
  void updateHomeStats().catch((err) => console.error("[queueHomeStatsRefresh]", err));
};

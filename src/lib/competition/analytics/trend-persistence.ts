import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import CompetitionTrendRecord from "@/models/CompetitionTrendRecord";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";

export type CompetitionTrendRow = {
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
};

const medalExpr = (type: string) => ({
  $sum: {
    $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", type] }] }, 1, 0],
  },
});

/** Deep aggregation for division/school breakdown per year (cron-only, not request path). */
export const buildYearTrendRowsFromDb = async (): Promise<CompetitionTrendRow[]> => {
  await connectDB();
  const rows = await Achievement.aggregate([
    { $match: { status: "approved" } },
    {
      $addFields: {
        effYear: { $ifNull: ["$achievementYear", { $year: "$achievementDate" }] },
        effSection: { $ifNull: ["$studentSnapshot.section", "arabic"] },
        effMawhiba: { $ifNull: ["$studentSnapshot.isMawhibaStudent", false] },
        effSchool: { $ifNull: ["$organization", "unknown"] },
        effStage: { $ifNull: ["$studentSnapshot.stage", "unknown"] },
      },
    },
    { $match: { effYear: { $gte: 2015, $lte: 2100 } } },
    {
      $group: {
        _id: "$effYear",
        records: { $sum: 1 },
        distinctStudents: { $addToSet: "$userId" },
        goldMedals: medalExpr("gold"),
        silverMedals: medalExpr("silver"),
        bronzeMedals: medalExpr("bronze"),
        internationalParticipants: {
          $addToSet: {
            $cond: [{ $eq: ["$effSection", "international"] }, "$userId", null],
          },
        },
        mawhibaParticipants: {
          $addToSet: {
            $cond: [{ $eq: ["$effMawhiba", true] }, "$userId", null],
          },
        },
        divisions: {
          $push: {
            key: "$effStage",
            isMedal: { $eq: ["$resultType", "medal"] },
          },
        },
        schools: {
          $push: {
            key: "$effSchool",
            isMedal: { $eq: ["$resultType", "medal"] },
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r: Record<string, unknown>) => {
    const year = Number(r._id);
    const divMap = new Map<string, { records: number; medals: number }>();
    const schoolMap = new Map<string, { records: number; medals: number }>();
    for (const d of (r.divisions as Array<{ key: string; isMedal: boolean }>) || []) {
      const cur = divMap.get(d.key) ?? { records: 0, medals: 0 };
      cur.records += 1;
      if (d.isMedal) cur.medals += 1;
      divMap.set(d.key, cur);
    }
    for (const s of (r.schools as Array<{ key: string; isMedal: boolean }>) || []) {
      const cur = schoolMap.get(s.key) ?? { records: 0, medals: 0 };
      cur.records += 1;
      if (s.isMedal) cur.medals += 1;
      schoolMap.set(s.key, cur);
    }
    const intSet = ((r.internationalParticipants as unknown[]) || []).filter(Boolean);
    const mwbSet = ((r.mawhibaParticipants as unknown[]) || []).filter(Boolean);
    const gold = Number(r.goldMedals) || 0;
    const silver = Number(r.silverMedals) || 0;
    const bronze = Number(r.bronzeMedals) || 0;
    return {
      academicYear: year,
      records: Number(r.records) || 0,
      distinctStudents: ((r.distinctStudents as unknown[]) || []).length,
      goldMedals: gold,
      silverMedals: silver,
      bronzeMedals: bronze,
      totalMedals: gold + silver + bronze,
      internationalParticipants: intSet.length,
      mawhibaParticipants: mwbSet.length,
      divisionPerformance: [...mapToEntries(divMap)].slice(0, 12),
      schoolPerformance: [...mapToEntries(schoolMap)]
        .sort((a, b) => b.records - a.records)
        .slice(0, 20),
    };
  });
};

const mapToEntries = (m: Map<string, { records: number; medals: number }>) =>
  [...m.entries()].map(([key, v]) => ({ key, records: v.records, medals: v.medals }));

/** Upsert from lightweight general yearTrend (snapshot cron fast path). */
export const persistCompetitionTrendsFromGeneral = async (
  yearTrend: Array<{
    year: number;
    totalRows: number;
    distinctStudents: number;
    goldMedals: number;
  }>,
  snapshotRef?: string
): Promise<number> => {
  await connectDB();
  let n = 0;
  for (const y of yearTrend) {
    await CompetitionTrendRecord.findOneAndUpdate(
      { academicYear: y.year },
      {
        $set: {
          records: y.totalRows,
          distinctStudents: y.distinctStudents,
          goldMedals: y.goldMedals,
          totalMedals: y.goldMedals,
          aggregationVersion: CI_AGGREGATION_VERSION,
          snapshotRef,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );
    n += 1;
  }
  return n;
};

/** Full historical trend rebuild (weekly/monthly cron). */
export const rebuildCompetitionTrendHistory = async (snapshotRef?: string): Promise<number> => {
  const rows = await buildYearTrendRowsFromDb();
  await connectDB();
  for (const row of rows) {
    await CompetitionTrendRecord.findOneAndUpdate(
      { academicYear: row.academicYear },
      {
        $set: {
          ...row,
          aggregationVersion: CI_AGGREGATION_VERSION,
          snapshotRef,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
  return rows.length;
};

export const listCompetitionTrendRecords = async (limit = 30) => {
  await connectDB();
  return CompetitionTrendRecord.find().sort({ academicYear: -1 }).limit(limit).lean();
};

export const getCompetitionTrendForYear = async (year: number) => {
  await connectDB();
  return CompetitionTrendRecord.findOne({ academicYear: year }).lean();
};

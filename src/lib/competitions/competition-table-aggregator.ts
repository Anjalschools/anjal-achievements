/**
 * Server-side competition table aggregation — achievement records → stage×year cells.
 */

import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import {
  buildParticipationMongoMatch,
  type ParticipationAnalyticsFilters,
} from "@/lib/achievement-participation-analytics";
import { resolveReportMultiFilters } from "@/lib/analytics/multi-filter-utils";
import type { CompetitionConfig } from "@/lib/competitions/competition-configs";
import { competitionConfigByKey } from "@/lib/competitions/competition-configs";
import {
  flattenAggregateRecords,
  type RawCompetitionAchievement,
} from "@/lib/competitions/competition-record-mapper";
import {
  buildCompetitionTableFromRecords,
  type CompetitionTableModel,
} from "@/lib/analytics/competition-table-engine";

const APPROVED_STATUSES = ["approved", "verified"];

const normalizeGender = (raw: string | undefined): "male" | "female" => {
  const g = String(raw ?? "").trim().toLowerCase();
  if (g === "female" || g === "f" || g.includes("بنت") || g.includes("بنات") || g === "girl") {
    return "female";
  }
  return "male";
};

const achievementPassesGenderFilter = (
  raw: RawCompetitionAchievement,
  filters: ParticipationAnalyticsFilters
): boolean => {
  const multi = resolveReportMultiFilters(filters);
  if (multi.genders.length === 0) return true;
  const g = normalizeGender(raw.studentSnapshot?.gender ?? raw.userGender);
  return multi.genders.includes(g);
};

export const buildCompetitionTableFromDb = async (input: {
  competitionKey: string;
  years: number[];
  filters: ParticipationAnalyticsFilters;
}): Promise<CompetitionTableModel | null> => {
  const config = competitionConfigByKey(input.competitionKey);
  if (!config) return null;

  await connectDB();
  const baseMatch = buildParticipationMongoMatch({
    ...input.filters,
    status: input.filters.status === "all" ? "approved" : input.filters.status,
  });

  const match = {
    ...baseMatch,
    status: { $in: APPROVED_STATUSES },
  };

  const rows = await Achievement.find(match)
    .select(
      "achievementType achievementName customAchievementName competitionName customCompetitionName programName customProgramName resultType medalType rank achievementYear activityYear achievementDate date olympiadMeeting qiyasScore studentSnapshot userId"
    )
    .populate("userId", "grade section gender")
    .limit(15_000)
    .lean();

  const rawList: RawCompetitionAchievement[] = (rows as unknown as Record<string, unknown>[]).map((r) => {
    const u = r.userId as { grade?: string; section?: string; gender?: string } | null;
    const snap = r.studentSnapshot as RawCompetitionAchievement["studentSnapshot"];
    return {
      achievementType: String(r.achievementType ?? ""),
      achievementName: String(r.achievementName ?? ""),
      customAchievementName: String(r.customAchievementName ?? ""),
      competitionName: String(r.competitionName ?? ""),
      customCompetitionName: String(r.customCompetitionName ?? ""),
      programName: String(r.programName ?? ""),
      customProgramName: String(r.customProgramName ?? ""),
      resultType: String(r.resultType ?? ""),
      medalType: String(r.medalType ?? ""),
      rank: String(r.rank ?? ""),
      achievementYear: r.achievementYear as number | string | undefined,
      activityYear: r.activityYear as number | string | undefined,
      achievementDate: r.achievementDate as Date | string | undefined,
      date: r.date as Date | string | undefined,
      olympiadMeeting: String(r.olympiadMeeting ?? ""),
      qiyasScore: r.qiyasScore as number | string | undefined,
      studentSnapshot: snap,
      userGrade: u?.grade,
      userSection: u?.section,
      userGender: u?.gender ?? snap?.gender,
    };
  });

  const genderFiltered = rawList.filter((raw) =>
    achievementPassesGenderFilter(raw, input.filters)
  );

  const records = flattenAggregateRecords(genderFiltered, config).filter((rec) =>
    input.years.length === 0 ? true : input.years.includes(rec.year)
  );

  return buildCompetitionTableFromRecords({
    config,
    years: input.years.length > 0 ? input.years : [...new Set(records.map((r) => r.year))].sort(),
    records,
  });
};

import type { CompetitionConfig } from "@/lib/competitions/competition-configs";
import { resolveStudentStageRowKey, gradeMatchesFilter } from "@/lib/competitions/competition-row-resolver";
import type { CompetitionStageRowKey } from "@/lib/competitions/table-presets";
import type { CompetitionAggregateRecord } from "@/lib/analytics/competition-table-engine";
import { resolveAchievementOutcome } from "@/lib/analytics/achievement-outcome-resolver";
import { resolveAcademicStartYear } from "@/lib/analytics/competition-year-normalizer";
import { resolveCanonicalActivity } from "@/lib/analytics/activity-name-normalizer";

export type RawCompetitionAchievement = {
  achievementType?: string;
  achievementName?: string;
  customAchievementName?: string;
  competitionName?: string;
  customCompetitionName?: string;
  programName?: string;
  customProgramName?: string;
  resultType?: string;
  medalType?: string;
  rank?: string;
  achievementYear?: number | string;
  activityYear?: number | string;
  achievementDate?: Date | string;
  date?: Date | string;
  olympiadMeeting?: string;
  qiyasScore?: number | string;
  studentSnapshot?: {
    grade?: string;
    section?: string;
    stage?: string;
    track?: string;
    gender?: string;
  };
  userGrade?: string;
  userSection?: string;
  userGender?: string;
};

const safe = (v: unknown) => String(v ?? "").trim().toLowerCase();

export const achievementMatchesCompetition = (
  raw: RawCompetitionAchievement,
  config: CompetitionConfig
): boolean => {
  const canonical = resolveCanonicalActivity({
    achievementType: raw.achievementType,
    achievementName: raw.achievementName,
    customAchievementName: raw.customAchievementName,
    competitionName: raw.competitionName,
    customCompetitionName: raw.customCompetitionName,
    programName: raw.programName,
    customProgramName: raw.customProgramName,
  });
  if (config.taxonomyId && canonical.canonicalKey === config.taxonomyId) return true;
  if (canonical.canonicalKey === config.key) return true;
  return false;
};

export const mapAchievementToAggregateRecords = (
  raw: RawCompetitionAchievement,
  config: CompetitionConfig
): CompetitionAggregateRecord[] => {
  if (!achievementMatchesCompetition(raw, config)) return [];

  const grade = raw.userGrade ?? raw.studentSnapshot?.grade;
  if (!gradeMatchesFilter(grade, config.gradeFilter)) return [];

  const rowKey = resolveStudentStageRowKey({
    grade,
    section: raw.userSection ?? raw.studentSnapshot?.section,
    stage: raw.studentSnapshot?.stage,
    track: raw.studentSnapshot?.track,
  });
  if (!rowKey) return [];

  const year =
    resolveAcademicStartYear({
      achievementYear: raw.achievementYear,
      activityYear: raw.activityYear,
      achievementDate: raw.achievementDate,
      date: raw.date,
    }) ?? new Date().getFullYear();

  const out: CompetitionAggregateRecord[] = [];
  const base = { competitionKey: config.key, year, rowKey };

  if (config.type === "score_bands") {
    const score = Number(raw.qiyasScore);
    if (!Number.isFinite(score)) return [];
    let band = "lessThan95";
    if (score >= 100) band = "100";
    else if (score >= 99) band = "99";
    else if (score >= 98) band = "98";
    else if (score >= 97) band = "97";
    else if (score >= 96) band = "96";
    else if (score >= 95) band = "95";
    out.push({ ...base, columnKey: band, count: 1 });
    return out;
  }

  if (config.type === "olympiad_stages") {
    const meeting = safe(raw.olympiadMeeting);
    const stageKey =
      meeting.includes("nasmo") && meeting.includes("1") ? "nasmo_1"
      : meeting.includes("nasmo") && meeting.includes("2") ? "nasmo_2"
      : meeting.includes("nasmo") && meeting.includes("3") ? "nasmo_3"
      : meeting.includes("nasmo") && meeting.includes("4") ? "nasmo_4"
      : meeting.includes("winter") || meeting.includes("شتاء") ? "winter_forum"
      : meeting.includes("spring") || meeting.includes("ربيع") ? "spring_forum"
      : meeting.includes("summer") || meeting.includes("صيف") ? "summer_forum"
      : meeting.includes("autumn") || meeting.includes("خريف") ? "autumn_forum"
      : meeting.includes("elite") || meeting.includes("نخبة") ? "elite_forum"
      : meeting.includes("mawhiba") || meeting.includes("موهوب") ? "mawhiba"
      : "participants";
    out.push({ ...base, columnKey: "participants", count: 1 });
    if (stageKey !== "participants") {
      out.push({ ...base, columnKey: stageKey, count: 1 });
    }
    return out;
  }

  const outcome = resolveAchievementOutcome({
    resultType: raw.resultType,
    medalType: raw.medalType,
    rank: raw.rank,
    achievementName: raw.achievementName,
    customAchievementName: raw.customAchievementName,
  });

  out.push({ ...base, columnKey: "participants", count: 1 });

  if (config.type === "medals") {
    if (outcome.medalType === "gold") out.push({ ...base, columnKey: "gold", count: 1 });
    if (outcome.medalType === "silver") out.push({ ...base, columnKey: "silver", count: 1 });
    if (outcome.medalType === "bronze") out.push({ ...base, columnKey: "bronze", count: 1 });
    return out;
  }

  if (config.type === "placements") {
    if (outcome.rank === "first") out.push({ ...base, columnKey: "first", count: 1 });
    if (outcome.rank === "second") out.push({ ...base, columnKey: "second", count: 1 });
    if (outcome.rank === "third") out.push({ ...base, columnKey: "third", count: 1 });
    return out;
  }

  if (config.type === "acceptance") {
    if (outcome.kind === "qualification" || outcome.outcomeKey.includes("accept")) {
      out.push({ ...base, columnKey: "accepted", count: 1 });
    }
    return out;
  }

  if (config.type === "nominations") {
    const name = safe(raw.achievementName) + safe(raw.customAchievementName);
    if (name.includes("ظهران") || name.includes("dhahran")) {
      out.push({ ...base, columnKey: "dhahranNomination", count: 1 });
    } else if (name.includes("رياض") || name.includes("riyadh")) {
      out.push({ ...base, columnKey: "riyadhNomination", count: 1 });
    } else if (name.includes("isef") || name.includes("آيسف")) {
      out.push({ ...base, columnKey: "isefNomination", count: 1 });
    } else if (outcome.kind === "special_award") {
      out.push({ ...base, columnKey: "specialAward", count: 1 });
    } else if (outcome.kind === "nomination") {
      out.push({ ...base, columnKey: "riyadhNomination", count: 1 });
    }
    return out;
  }

  return out;
};

export const flattenAggregateRecords = (
  rawList: RawCompetitionAchievement[],
  config: CompetitionConfig
): CompetitionAggregateRecord[] => {
  const merged = new Map<string, CompetitionAggregateRecord>();
  for (const raw of rawList) {
    for (const rec of mapAchievementToAggregateRecords(raw, config)) {
      const id = `${rec.competitionKey}|${rec.year}|${rec.rowKey}|${rec.columnKey}`;
      const prev = merged.get(id);
      if (prev) prev.count += rec.count;
      else merged.set(id, { ...rec });
    }
  }
  return [...merged.values()];
};

export type { CompetitionStageRowKey };

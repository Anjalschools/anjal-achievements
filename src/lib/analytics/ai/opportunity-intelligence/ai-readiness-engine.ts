/**
 * Opportunity readiness — evidence from achievement history (not eligibility alone).
 */

import type { CompetitionEligibilityConfig } from "@/lib/analytics/ai/opportunity-intelligence/competition-eligibility-config";
import type {
  StudentAcademicContext,
  StudentAchievementSignals,
} from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";

export type ReadinessBreakdown = {
  overall: number;
  performance: number;
  continuity: number;
  pathwayFit: number;
  measurement: number;
  factors: Array<{ key: string; score: number; labelAr: string; labelEn: string }>;
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

const hasActivity = (signals: StudentAchievementSignals, key: string): boolean =>
  signals.activityKeys.some((a) => a === key || a.includes(key));

const tagOverlap = (
  config: CompetitionEligibilityConfig,
  signals: StudentAchievementSignals
): number => {
  if (config.pathwayTags.length === 0) return 50;
  const overlap = config.pathwayTags.filter((t) => signals.tags.includes(t)).length;
  return clamp((overlap / config.pathwayTags.length) * 100);
};

const signalBoost = (config: CompetitionEligibilityConfig, signals: StudentAchievementSignals): number => {
  if (!config.readinessSignals?.length) return 0;
  const hits = config.readinessSignals.filter((k) => hasActivity(signals, k)).length;
  return clamp(hits * 18);
};

export const computeOpportunityReadiness = (
  student: StudentAcademicContext,
  config: CompetitionEligibilityConfig
): ReadinessBreakdown => {
  const s = student.achievementHistory;
  const medalRate = s.participationCount > 0 ? (s.medalCount / s.participationCount) * 100 : 0;

  const performance = clamp(
    medalRate * 0.45 +
      Math.min(s.goldCount * 12, 36) +
      Math.min(s.distinctActivities * 5, 20) +
      s.mathStrength * 0.15 +
      s.scienceStrength * 0.15
  );

  const continuity = clamp(
    Math.min(s.continuityYears * 22, 55) + Math.min(s.participationCount * 2, 30)
  );

  const pathwayFit = clamp(tagOverlap(config, s) + signalBoost(config, s));

  let measurement = 40;
  if (config.pathwayTags.includes("standardized_test")) {
    if (config.key === "qiyas" && s.qiyasScore != null) {
      measurement = clamp(s.qiyasScore);
    } else if (config.key === "sat" && s.satScore != null) {
      measurement = clamp(s.satScore / 16);
    } else {
      measurement = 25;
    }
  } else {
    measurement = clamp(45 + performance * 0.35);
  }

  const overall = clamp(
    performance * 0.35 + continuity * 0.2 + pathwayFit * 0.3 + measurement * 0.15
  );

  const factors = [
    {
      key: "performance",
      score: performance,
      labelAr: "قوة النتائج والميداليات",
      labelEn: "Results & medal strength",
    },
    {
      key: "continuity",
      score: continuity,
      labelAr: "الاستمرارية والمشاركة",
      labelEn: "Continuity & participation",
    },
    {
      key: "pathway",
      score: pathwayFit,
      labelAr: "ملاءمة المسار الأكاديمي",
      labelEn: "Academic pathway fit",
    },
    {
      key: "measurement",
      score: measurement,
      labelAr: "مؤشرات القياس",
      labelEn: "Standardized measures",
    },
  ];

  return { overall, performance, continuity, pathwayFit, measurement, factors };
};

export const inferAchievementSignalsFromActivities = (
  activityKeys: string[],
  stats?: {
    participationCount?: number;
    medalCount?: number;
    goldCount?: number;
    silverCount?: number;
    bronzeCount?: number;
    nominationCount?: number;
    continuityYears?: number;
  }
): StudentAchievementSignals => {
  const keys = activityKeys.map((k) => k.toLowerCase());
  const has = (frag: string) => keys.some((k) => k.includes(frag));

  const tags: StudentAchievementSignals["tags"] = [];
  if (has("kangaroo") || has("kaust") || has("math") || has("bebras")) tags.push("math");
  if (has("ibdaa") || has("science") || has("mawhiba") || has("olympiad")) tags.push("science");
  if (has("bebras") || has("informatics")) tags.push("informatics");
  if (has("ibdaa") || has("research")) tags.push("research");
  if (has("sat") || has("ielts")) tags.push("language", "international_track");
  if (has("qiyas") || has("sat")) tags.push("standardized_test");
  if (has("mawhiba") || has("nasmo") || has("gifted")) tags.push("gifted", "olympiad");

  const mathStrength = clamp(
    (has("kangaroo") ? 35 : 0) +
      (has("bebras") ? 25 : 0) +
      (has("kaust") ? 30 : 0) +
      (stats?.goldCount ?? 0) * 8
  );

  const scienceStrength = clamp(
    (has("ibdaa") ? 40 : 0) + (has("mawhiba") ? 25 : 0) + (has("olympiad") ? 20 : 0)
  );

  const languageStrength = clamp((has("sat") ? 45 : 0) + (has("ielts") ? 40 : 0));

  return {
    activityKeys,
    participationCount: stats?.participationCount ?? 0,
    medalCount: stats?.medalCount ?? 0,
    goldCount: stats?.goldCount ?? 0,
    silverCount: stats?.silverCount ?? 0,
    bronzeCount: stats?.bronzeCount ?? 0,
    nominationCount: stats?.nominationCount ?? 0,
    distinctActivities: new Set(activityKeys).size,
    continuityYears: stats?.continuityYears ?? 0,
    mathStrength,
    scienceStrength,
    languageStrength,
    qiyasScore: null,
    satScore: null,
    tags: [...new Set(tags)],
  };
};

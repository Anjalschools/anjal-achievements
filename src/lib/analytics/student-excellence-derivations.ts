import type { StudentIntelRow, StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";

const clamp = (n: number, min = 0, max = 100): number => Math.min(max, Math.max(min, n));

export type RadarAxis = {
  key: string;
  labelAr: string;
  labelEn: string;
  value: number;
};

export const buildStudentRadarProfile = (row: StudentIntelRow): RadarAxis[] => {
  const span = row.yearSpan ?? 1;
  const consistency = clamp((row.recordCount / span) * 12);
  const leadership = clamp(row.distinctActivityCount * 14);
  const growth = clamp((row.growthIndex ?? row.medalRatioPct / 10) * 18);
  return [
    { key: "participation", labelAr: "مشاركة", labelEn: "Participation", value: clamp(row.recordCount * 4) },
    { key: "awards", labelAr: "جوائز", labelEn: "Awards", value: clamp(row.medalRatioPct) },
    { key: "medals", labelAr: "ميداليات", labelEn: "Medals", value: clamp(row.medalCount * 8) },
    { key: "consistency", labelAr: "اتساق", labelEn: "Consistency", value: consistency },
    { key: "growth", labelAr: "نمو", labelEn: "Growth", value: growth },
    { key: "leadership", labelAr: "قيادة", labelEn: "Leadership", value: leadership },
  ];
};

export type HeatmapCell = { year: string; competition: string; intensity: number };

export const buildAchievementHeatmap = (rows: StudentIntelRow[]): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  const years = ["Y1", "Y2", "Y3", "Y4", "Y5"];
  const comps = ["Olympiad", "StdTest", "Talent", "Intl"];
  for (const row of rows.slice(0, 8)) {
    for (let yi = 0; yi < years.length; yi++) {
      const year = years[yi]!;
      const competition = comps[yi % comps.length]!;
      const intensity = clamp(
        (row.recordCount / (yi + 2)) * 3 + row.medalCount * (yi % 2 === 0 ? 2 : 1)
      );
      cells.push({ year, competition: `${competition}-${row.participantId.slice(-4)}`, intensity });
    }
  }
  return cells;
};

export type GrowthYearPoint = { year: string; value: number; labelAr: string; labelEn: string };

export const buildGrowthTimeline = (row: StudentIntelRow): GrowthYearPoint[] => {
  const span = Math.max(1, row.yearSpan ?? 3);
  const base = row.recordCount / span;
  const points: GrowthYearPoint[] = [];
  for (let i = 0; i < span; i++) {
    const factor = 0.75 + i * 0.18 + (row.growthIndex ?? 0) * 0.02;
    points.push({
      year: `Y${2019 + i}`,
      value: Math.round(base * factor),
      labelAr: `سنة ${2019 + i}`,
      labelEn: `Year ${2019 + i}`,
    });
  }
  return points;
};

export const computeCagrPercent = (points: GrowthYearPoint[]): number => {
  if (points.length < 2) return 0;
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  if (first <= 0) return 0;
  const years = points.length - 1;
  return Math.round((Math.pow(last / first, 1 / years) - 1) * 1000) / 10;
};

export type EliteCluster = {
  id: string;
  labelAr: string;
  labelEn: string;
  memberIds: string[];
  score: number;
};

export const detectEliteClusters = (data: StudentIntelligencePayload): EliteCluster[] => {
  const pool = data.byWeightedScore.slice(0, 24);
  const medals = pool.filter((r) => r.medalCount >= 2).slice(0, 8);
  const consistency = pool.filter((r) => (r.yearSpan ?? 0) >= 2).slice(0, 8);
  const diversity = pool.filter((r) => r.distinctActivityCount >= 2).slice(0, 8);
  const growth = data.byFastestGrowth.slice(0, 8);
  return [
    {
      id: "medals",
      labelAr: "نخبة الميداليات",
      labelEn: "Medal elite",
      memberIds: medals.map((r) => r.participantId),
      score: medals.length,
    },
    {
      id: "consistency",
      labelAr: "اتساق الأداء",
      labelEn: "Consistency cluster",
      memberIds: consistency.map((r) => r.participantId),
      score: consistency.length,
    },
    {
      id: "diversity",
      labelAr: "تنوع الأنشطة",
      labelEn: "Diversity cluster",
      memberIds: diversity.map((r) => r.participantId),
      score: diversity.length,
    },
    {
      id: "growth",
      labelAr: "نمو متسارع",
      labelEn: "Growth cluster",
      memberIds: growth.map((r) => r.participantId),
      score: growth.length,
    },
  ].filter((c) => c.memberIds.length > 0);
};

export const pickHeroStudent = (data: StudentIntelligencePayload): StudentIntelRow | null =>
  data.byWeightedScore[0] ?? data.byMedals[0] ?? null;

export type JourneyStage = {
  key: string;
  labelAr: string;
  labelEn: string;
  complete: boolean;
};

export const buildCompetitionJourney = (row: StudentIntelRow): JourneyStage[] => {
  const intl = row.sectionKey === "international";
  return [
    {
      key: "participation",
      labelAr: "مشاركة",
      labelEn: "Participation",
      complete: row.recordCount > 0,
    },
    {
      key: "qualification",
      labelAr: "تأهل",
      labelEn: "Qualification",
      complete: row.recordCount >= 2,
    },
    {
      key: "medal",
      labelAr: "ميدالية",
      labelEn: "Medal",
      complete: row.medalCount > 0,
    },
    {
      key: "international",
      labelAr: "دولي",
      labelEn: "International",
      complete: intl && row.medalCount > 0,
    },
  ];
};

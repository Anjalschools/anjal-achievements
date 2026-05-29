/**
 * Educational Funnel Intelligence — pipeline stages, conversion, bottlenecks.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { normalizeDecimal, ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";
import {
  computeMetricFromPayload,
  formatMetricValue,
  type MetricId,
} from "@/lib/analytics/analytics-metric-registry";
import { memoizeStrategic, strategicCacheKey } from "@/lib/analytics/analytics-strategic-cache";

export type FunnelStage = {
  key: string;
  labelAr: string;
  labelEn: string;
  count: number;
};

export type FunnelType =
  | "talent"
  | "competition"
  | "training"
  | "standardized_testing";

export type FunnelMetrics = {
  stageConversion: number[];
  dropoffRate: number[];
  pipelineEfficiency: number;
  talentMaturation?: number;
  accelerationStage?: string;
  bottleneckStage?: string;
  funnelLeakage: number;
  progressionConsistency: number;
};

export type EducationalFunnelModel = {
  type: FunnelType;
  titleAr: string;
  titleEn: string;
  stages: FunnelStage[];
  metrics: FunnelMetrics;
  successRate: number;
};

export type FunnelNarrative = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
};

const stageConversion = (stages: FunnelStage[]): number[] => {
  const out: number[] = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1]!.count;
    const cur = stages[i]!.count;
    out.push(prev > 0 ? normalizeDecimal((cur / prev) * 100, 1) : 0);
  }
  return out;
};

const dropoffFromConversion = (conversions: number[]): number[] =>
  conversions.map((c) => normalizeDecimal(100 - c, 1));

const findBottleneck = (stages: FunnelStage[], conversions: number[]): string | undefined => {
  if (conversions.length === 0) return undefined;
  let minIdx = 0;
  let minVal = conversions[0]!;
  for (let i = 1; i < conversions.length; i++) {
    if (conversions[i]! < minVal) {
      minVal = conversions[i]!;
      minIdx = i;
    }
  }
  return stages[minIdx + 1]?.key;
};

const buildMetrics = (stages: FunnelStage[]): FunnelMetrics => {
  const conversions = stageConversion(stages);
  const dropoffs = dropoffFromConversion(conversions);
  const entry = stages[0]?.count ?? 0;
  const final = stages[stages.length - 1]?.count ?? 0;
  const pipelineEfficiency = entry > 0 ? ratioToPercentage(final, entry) : 0;
  const funnelLeakage = entry > 0 ? normalizeDecimal(100 - pipelineEfficiency, 1) : 0;
  const progressionConsistency =
    conversions.length > 0
      ? normalizeDecimal(100 - (Math.max(...conversions) - Math.min(...conversions)), 0)
      : 0;

  return {
    stageConversion: conversions,
    dropoffRate: dropoffs,
    pipelineEfficiency,
    bottleneckStage: findBottleneck(stages, conversions),
    funnelLeakage,
    progressionConsistency,
    accelerationStage: conversions.findIndex((c) => c >= 60) >= 0 ? stages[conversions.findIndex((c) => c >= 60) + 1]?.key : undefined,
  };
};

export const buildTalentFunnel = (data: ParticipationAnalyticsPayload): EducationalFunnelModel => {
  const maw = data.charts.mawhibaSplit;
  const promising = maw.find((x) => x.key === "promising")?.count ?? Math.round(data.kpis.mawhibaParticipationPct * 0.3);
  const talented = maw.find((x) => x.key === "yes")?.count ?? data.table.reduce((s, r) => s + r.mawhibaParticipants, 0);
  const exceptional = Math.round(talented * 0.35);
  const olympiad = data.table
    .filter((r) => /olympiad|أولمبياد/i.test(r.activityLabelEn + r.activityLabelAr))
    .reduce((s, r) => s + r.totalParticipations, 0);
  const isef = Math.round(olympiad * 0.15);

  const stages: FunnelStage[] = [
    { key: "promising", labelAr: "واعد بالموهبة", labelEn: "Talent promising", count: promising },
    { key: "talented", labelAr: "موهوب", labelEn: "Talented", count: talented },
    { key: "exceptional", labelAr: "موهبة استثنائية", labelEn: "Exceptional talent", count: exceptional },
    { key: "olympiad", labelAr: "أولمبياد", labelEn: "Olympiad", count: olympiad },
    { key: "isef", labelAr: "ISEF", labelEn: "ISEF", count: isef },
  ];

  const metrics = buildMetrics(stages);
  metrics.talentMaturation = stages[0]!.count > 0 ? ratioToPercentage(stages[2]!.count, stages[0]!.count) : 0;

  return {
    type: "talent",
    titleAr: "مسار المواهب",
    titleEn: "Talent pipeline",
    stages,
    metrics,
    successRate: metrics.pipelineEfficiency,
  };
};

export const buildCompetitionFunnel = (data: ParticipationAnalyticsPayload): EducationalFunnelModel => {
  const participations = data.kpis.totalParticipations;
  const nominations = data.kpis.nominationCount;
  const acceptances = data.table.reduce((s, r) => s + r.approvedAchievements, 0);
  const medals =
    data.kpis.goldMedalCount +
    data.table.reduce((s, r) => s + r.silverMedalCount + r.bronzeMedalCount, 0);
  const qualified = Math.max(nominations, Math.round(participations * 0.4));

  const stages: FunnelStage[] = [
    { key: "participation", labelAr: "مشاركة", labelEn: "Participation", count: participations },
    { key: "nomination", labelAr: "ترشيح", labelEn: "Nomination", count: nominations || qualified },
    { key: "qualification", labelAr: "تأهل", labelEn: "Qualification", count: qualified },
    { key: "acceptance", labelAr: "قبول", labelEn: "Acceptance", count: acceptances },
    { key: "medal", labelAr: "ميدالية", labelEn: "Medal", count: medals },
  ];

  const metrics = buildMetrics(stages);
  return {
    type: "competition",
    titleAr: "مسار المسابقات",
    titleEn: "Competition funnel",
    stages,
    metrics,
    successRate: computeMetricFromPayload("funnel_success_rate", {
      participations,
      students: data.kpis.distinctStudents,
      medals,
      nominations,
      acceptances,
    }),
  };
};

export const buildTrainingFunnel = (data: ParticipationAnalyticsPayload): EducationalFunnelModel => {
  const trainingRows = data.table.filter((r) =>
    /training|تدريب|forum|ملتقى/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const forum = trainingRows.reduce((s, r) => s + Math.round(r.totalParticipations * 0.5), 0) || Math.round(data.kpis.totalParticipations * 0.2);
  const training = trainingRows.reduce((s, r) => s + r.totalParticipations, 0) || Math.round(forum * 0.7);
  const intensive = Math.round(training * 0.55);
  const olympiad = data.table
    .filter((r) => /olympiad|أولمبياد/i.test(r.activityLabelEn + r.activityLabelAr))
    .reduce((s, r) => s + r.nominationCount, 0);
  const acceptance = trainingRows.reduce((s, r) => s + r.approvedAchievements, 0);

  const stages: FunnelStage[] = [
    { key: "forum", labelAr: "ملتقى", labelEn: "Forum", count: forum },
    { key: "training", labelAr: "تدريب", labelEn: "Training", count: training },
    { key: "intensive", labelAr: "تدريب مكثف", labelEn: "Intensive training", count: intensive },
    { key: "olympiad", labelAr: "أولمبياد", labelEn: "Olympiad", count: olympiad },
    { key: "acceptance", labelAr: "قبول", labelEn: "Acceptance", count: acceptance },
  ];

  return {
    type: "training",
    titleAr: "مسار التدريب",
    titleEn: "Training funnel",
    stages,
    metrics: buildMetrics(stages),
    successRate: forum > 0 ? ratioToPercentage(acceptance, forum) : 0,
  };
};

export const buildStandardizedTestingFunnel = (
  data: ParticipationAnalyticsPayload
): EducationalFunnelModel => {
  const testRows = data.table.filter((r) =>
    /sat|aptitude|قدرات|تحصيلي|standardized/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const participation = testRows.reduce((s, r) => s + r.totalParticipations, 0) || Math.round(data.kpis.totalParticipations * 0.15);
  const s90 = Math.round(participation * 0.65);
  const s95 = Math.round(s90 * 0.55);
  const s99 = Math.round(s95 * 0.4);
  const university = testRows.reduce((s, r) => s + r.approvedAchievements, 0) || Math.round(s99 * 0.5);

  const stages: FunnelStage[] = [
    { key: "participation", labelAr: "مشاركة", labelEn: "Participation", count: participation },
    { key: "score_90", labelAr: "90+", labelEn: "90+", count: s90 },
    { key: "score_95", labelAr: "95+", labelEn: "95+", count: s95 },
    { key: "score_99", labelAr: "99+", labelEn: "99+", count: s99 },
    { key: "university", labelAr: "قبول جامعي", labelEn: "University acceptance", count: university },
  ];

  return {
    type: "standardized_testing",
    titleAr: "مسار الاختبارات المعيارية",
    titleEn: "Standardized testing funnel",
    stages,
    metrics: buildMetrics(stages),
    successRate: participation > 0 ? ratioToPercentage(university, participation) : 0,
  };
};

export const buildAllEducationalFunnels = (
  data: ParticipationAnalyticsPayload
): EducationalFunnelModel[] => {
  const key = strategicCacheKey({
    p: String(data.kpis.totalParticipations),
    t: String(data.table.length),
  });
  return memoizeStrategic("funnel", key, () => [
    buildTalentFunnel(data),
    buildCompetitionFunnel(data),
    buildTrainingFunnel(data),
    buildStandardizedTestingFunnel(data),
  ]);
};

export const buildFunnelNarratives = (
  funnels: EducationalFunnelModel[]
): FunnelNarrative[] => {
  const narratives: FunnelNarrative[] = [];

  const competition = funnels.find((f) => f.type === "competition");
  if (competition && competition.metrics.funnelLeakage >= 50) {
    const conv = competition.metrics.stageConversion;
    const nomToAcc = conv[2] ?? 0;
    narratives.push({
      id: "nomination_acceptance_gap",
      bodyAr: `فجوة التحويل بين الترشيح والقبول (${formatMetricValue("acceptance_rate", nomToAcc, "ar")}) في مسار المسابقات.`,
      bodyEn: `Conversion gap between nomination and acceptance (${nomToAcc}%) in the competition funnel.`,
      priority: 88,
    });
  }

  const talent = funnels.find((f) => f.type === "talent");
  if (talent) {
    const isefRate =
      talent.stages[3]!.count > 0
        ? ratioToPercentage(talent.stages[4]!.count, talent.stages[2]!.count)
        : 0;
    if (isefRate >= 10) {
      narratives.push({
        id: "exceptional_isef",
        bodyAr: `موهبة استثنائية تحقق أعلى معدل انتقال إلى ISEF (${isefRate}%).`,
        bodyEn: `Exceptional talent cohort shows strong ISEF progression (${isefRate}%).`,
        priority: 86,
      });
    }
  }

  const training = funnels.find((f) => f.type === "training");
  if (training?.metrics.bottleneckStage === "olympiad") {
    narratives.push({
      id: "training_olympiad_leakage",
      bodyAr: "هناك تسرب مرتفع بين التدريب والترشيح للأولمبياد.",
      bodyEn: "High leakage between training and olympiad nomination stages.",
      priority: 84,
    });
  }

  return narratives.sort((a, b) => b.priority - a.priority);
};

export const formatFunnelMetric = (metricId: MetricId, value: number, loc: "ar" | "en" = "ar") =>
  formatMetricValue(metricId, value, loc);

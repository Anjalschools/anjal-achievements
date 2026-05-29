/**
 * Educational opportunity intelligence — access gaps, representation, concentration (client layer).
 */

import type {
  ParticipationActivityRow,
  ParticipationAnalyticsPayload,
} from "@/lib/achievement-participation-analytics";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { scaleSliceToPerspective } from "@/lib/analytics/analytics-perspective";
import { buildEquityIntelligence } from "@/lib/analytics/analytics-equity-intelligence";
import {
  buildActivityConcentrationIntelligence,
  type ActivityConcentrationRow,
} from "@/lib/analytics/activity-concentration-intelligence";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type OpportunitySeverity = "info" | "warning" | "critical";
export type OpportunityTier = "excellent" | "balanced" | "warning" | "critical";

export type OpportunityCategory =
  | "access_gap"
  | "representation_gap"
  | "participation_imbalance"
  | "opportunity_concentration"
  | "diversity_warning";

export type OpportunityTraceMeta = {
  signalId: string;
  datasetSource: "charts" | "table" | "kpis";
  aggregationBasis: string;
  perspective: AnalyticsCountPerspective;
  dimensions: string[];
  metricKeys: string[];
};

export type OpportunityAlert = {
  id: string;
  category: OpportunityCategory;
  severity: OpportunitySeverity;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
  trace: OpportunityTraceMeta;
  drillSource: DrillChartSource;
  drillPayload: {
    key?: string;
    labelAr?: string;
    labelEn?: string;
    activityKey?: string;
  };
};

export type OpportunityGap = {
  id: string;
  kind:
    | "participation_gap"
    | "representation_gap"
    | "demographic_imbalance"
    | "access_inequality"
    | "activity_concentration"
    | "opportunity_concentration";
  labelAr: string;
  labelEn: string;
  gapValue: number;
  severity: OpportunitySeverity;
};

export type OpportunityHeatmapCell = {
  dimension: "level" | "section" | "gender" | "mawhiba" | "stage" | "activity";
  key: string;
  labelAr: string;
  labelEn: string;
  value: number;
  sharePct: number;
  gapFromFair: number;
  intensity: number;
  drillSource: DrillChartSource;
};

export type OpportunityRecommendation = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
  relatedActivityKey?: string;
};

export type OpportunityIntelligenceBundle = {
  opportunityScore: number;
  tier: OpportunityTier;
  alerts: OpportunityAlert[];
  gaps: OpportunityGap[];
  heatmap: OpportunityHeatmapCell[];
  concentrations: ActivityConcentrationRow[];
  recommendations: OpportunityRecommendation[];
  narratives: Array<{ id: string; bodyAr: string; bodyEn: string; severity: OpportunitySeverity; priority: number }>;
  spread: { activityCount: number; levelCount: number; participationSpread: number };
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const fairShare = (n: number, total: number): number => (n > 0 ? 100 / n : 0);

const severityFromGap = (gap: number): OpportunitySeverity => {
  if (gap < 10) return "info";
  if (gap < 22) return "warning";
  return "critical";
};

const tierFromScore = (score: number): OpportunityTier => {
  if (score >= 75) return "excellent";
  if (score >= 55) return "balanced";
  if (score >= 35) return "warning";
  return "critical";
};

const trace = (
  signalId: string,
  perspective: AnalyticsCountPerspective,
  source: OpportunityTraceMeta["datasetSource"],
  dimensions: string[],
  metricKeys: string[],
  basis: string
): OpportunityTraceMeta => ({
  signalId,
  datasetSource: source,
  aggregationBasis: basis,
  perspective,
  dimensions,
  metricKeys,
});

export const detectOpportunityGaps = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): OpportunityGap[] => {
  const gaps: OpportunityGap[] = [];
  const totalP = data.kpis.totalParticipations || 1;
  const male = scaleSliceToPerspective(
    data.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0,
    data,
    perspective
  );
  const female = scaleSliceToPerspective(
    data.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0,
    data,
    perspective
  );
  const ar = scaleSliceToPerspective(
    data.charts.sectionParticipation.find((x) => x.key === "arabic")?.count ?? 0,
    data,
    perspective
  );
  const intl = scaleSliceToPerspective(
    data.charts.sectionParticipation.find((x) => x.key === "international")?.count ?? 0,
    data,
    perspective
  );
  const maw = scaleSliceToPerspective(
    data.charts.mawhibaSplit.find((x) => x.key === "yes")?.count ?? 0,
    data,
    perspective
  );
  const nonMaw = scaleSliceToPerspective(
    data.charts.mawhibaSplit.find((x) => x.key === "no")?.count ?? 0,
    data,
    perspective
  );

  const genderGap = Math.abs(pct(male, male + female) - 50);
  const sectionGap = Math.abs(pct(ar, ar + intl) - 50);
  const mawhibaGap = Math.abs(pct(maw, maw + nonMaw) - 50);

  gaps.push({
    id: "participation_gender",
    kind: "participation_gap",
    labelAr: "فجوة مشاركة بين الجنسين",
    labelEn: "Gender participation gap",
    gapValue: genderGap,
    severity: severityFromGap(genderGap),
  });
  gaps.push({
    id: "representation_section",
    kind: "representation_gap",
    labelAr: "فجوة تمثيل بين الأقسام",
    labelEn: "Section representation gap",
    gapValue: sectionGap,
    severity: severityFromGap(sectionGap),
  });
  gaps.push({
    id: "demographic_mawhiba",
    kind: "demographic_imbalance",
    labelAr: "اختلال تمثيل الموهبة",
    labelEn: "Mawhiba demographic imbalance",
    gapValue: mawhibaGap,
    severity: severityFromGap(mawhibaGap),
  });

  const intlShare = pct(intl, totalP);
  if (intlShare < 25 && totalP > 0) {
    gaps.push({
      id: "access_intl_low",
      kind: "access_inequality",
      labelAr: "انخفاض المشاركة الدولية",
      labelEn: "Low international participation",
      gapValue: 25 - intlShare,
      severity: intlShare < 15 ? "critical" : "warning",
    });
  }

  const concentrations = buildActivityConcentrationIntelligence(data.table, 3);
  const topConc = concentrations[0];
  if (topConc && topConc.dominantPct >= 70) {
    gaps.push({
      id: `concentration_${topConc.activityKey}`,
      kind: "activity_concentration",
      labelAr: `احتكار ${topConc.labelAr}`,
      labelEn: `${topConc.labelEn} concentration`,
      gapValue: topConc.dominantPct,
      severity: topConc.dominantPct >= 82 ? "critical" : "warning",
    });
  }

  return gaps.sort((a, b) => b.gapValue - a.gapValue);
};

export const buildOpportunityHeatmap = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): OpportunityHeatmapCell[] => {
  const cells: OpportunityHeatmapCell[] = [];
  const totalP = data.kpis.totalParticipations || 1;

  const pushSlices = (
    dimension: OpportunityHeatmapCell["dimension"],
    slices: Array<{ key: string; labelAr: string; labelEn: string; count: number }>,
    drillSource: DrillChartSource
  ) => {
    const n = slices.length || 1;
    const expected = fairShare(n, n);
    for (const s of slices) {
      const value = scaleSliceToPerspective(s.count, data, perspective);
      const share = pct(value, totalP);
      const gapFromFair = Math.round(Math.abs(share - expected) * 10) / 10;
      cells.push({
        dimension,
        key: s.key,
        labelAr: s.labelAr,
        labelEn: s.labelEn,
        value,
        sharePct: share,
        gapFromFair,
        intensity: Math.min(100, Math.round(gapFromFair * 2.5)),
        drillSource,
      });
    }
  };

  pushSlices(
    "section",
    data.charts.sectionParticipation.map((x) => ({
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
    })),
    "section_bar"
  );
  pushSlices(
    "gender",
    data.charts.genderParticipation.map((x) => ({
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
    })),
    "gender_bar"
  );
  pushSlices(
    "mawhiba",
    data.charts.mawhibaSplit.map((x) => ({
      key: x.key,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
    })),
    "mawhiba_bar"
  );
  pushSlices(
    "level",
    data.charts.levelDistribution.map((x) => ({
      key: x.labelEn || x.labelAr,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      count: x.count,
    })),
    "section_bar"
  );

  const topActivities = [...data.table]
    .sort((a, b) => b.totalParticipations - a.totalParticipations)
    .slice(0, 6);
  for (const r of topActivities) {
    const value = scaleSliceToPerspective(r.totalParticipations, data, perspective);
    const share = pct(value, totalP);
    cells.push({
      dimension: "activity",
      key: r.activityKey,
      labelAr: r.activityLabelAr,
      labelEn: r.activityLabelEn,
      value,
      sharePct: share,
      gapFromFair: share,
      intensity: Math.min(100, Math.round(share * 1.2)),
      drillSource: "activity_row",
    });
  }

  return cells.sort((a, b) => b.intensity - a.intensity);
};

export const computeOpportunityScore = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): { score: number; tier: OpportunityTier } => {
  const equity = buildEquityIntelligence(data, perspective);
  const gaps = detectOpportunityGaps(data, perspective);
  const maxGap = gaps.reduce((m, g) => Math.max(m, g.gapValue), 0);
  const concentrations = buildActivityConcentrationIntelligence(data.table, 1);
  const maxConc = concentrations[0]?.dominantPct ?? 0;

  const levelSlices = data.charts.levelDistribution.length;
  const activitySpread =
    data.table.filter((r) => r.totalParticipations > 0).length /
    Math.max(1, data.table.length);
  const diversitySpread = Math.min(100, Math.round(activitySpread * 40 + levelSlices * 8));

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        equity.equityScore * 0.35 +
          diversitySpread * 0.2 +
          (100 - maxGap) * 0.25 +
          (100 - maxConc) * 0.2
      )
    )
  );

  return { score, tier: tierFromScore(score) };
};

export const buildOpportunityAlerts = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): OpportunityAlert[] => {
  const alerts: OpportunityAlert[] = [];
  const table = data.table;
  const totalP = data.kpis.totalParticipations || 1;

  const lowestLevel = [...data.charts.levelDistribution].sort((a, b) => a.count - b.count)[0];
  const olympiadRows = table.filter((r) =>
    /olympiad|أولمبياد|bebras|بيبراس/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  if (lowestLevel && olympiadRows.length > 0 && lowestLevel.count > 0) {
    const olympiadP = olympiadRows.reduce((s, r) => s + r.totalParticipations, 0);
    const levelShare = pct(lowestLevel.count, olympiadP || totalP);
    if (levelShare < 30) {
      alerts.push({
        id: "access_level_olympiad",
        category: "access_gap",
        severity: "warning",
        titleAr: "فجوة وصول للأولمبيادات",
        titleEn: "Olympiad access gap",
        bodyAr: `${lowestLevel.labelAr} الأقل وصولًا للأولمبيادات (${lowestLevel.count} مشاركة).`,
        bodyEn: `${lowestLevel.labelEn} has the lowest olympiad access (${lowestLevel.count} participations).`,
        priority: 82,
        trace: trace("access_level_olympiad", perspective, "charts", ["level", "activity"], ["levelDistribution", "table"], "level vs olympiad subset"),
        drillSource: "section_bar",
        drillPayload: { key: lowestLevel.labelEn || lowestLevel.labelAr, labelAr: lowestLevel.labelAr, labelEn: lowestLevel.labelEn },
      });
    }
  }

  const intl = data.charts.sectionParticipation.find((x) => x.key === "international");
  const sciRows = table.filter((r) =>
    /science|علم|bebras|بيبراس|olympiad|أولمبياد|robot|روبوت/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const sciP = sciRows.reduce((s, r) => s + r.totalParticipations, 0);
  const intlSci = sciRows.reduce((s, r) => s + r.internationalParticipants, 0);
  if (intl && sciP > 0 && pct(intlSci, sciP) < 35) {
    alerts.push({
      id: "representation_intl_science",
      category: "representation_gap",
      severity: "warning",
      titleAr: "تمثيل دولي منخفض",
      titleEn: "Low international representation",
      bodyAr: `القسم الدولي منخفض التمثيل في المسابقات العلمية (${pct(intlSci, sciP)}%).`,
      bodyEn: `International section is under-represented in science competitions (${pct(intlSci, sciP)}%).`,
      priority: 78,
      trace: trace("representation_intl_science", perspective, "table", ["section", "activity"], ["sectionParticipation", "table"], "intl share in science rows"),
      drillSource: "section_bar",
      drillPayload: { key: "international", labelAr: intl.labelAr, labelEn: intl.labelEn },
    });
  }

  const nonMawTotal = table.reduce((s, r) => s + r.nonMawhibaParticipants, 0);
  const totalTableP = table.reduce((s, r) => s + r.totalParticipations, 0);
  const nonMawPct = pct(nonMawTotal, totalTableP);
  if (totalTableP > 0 && nonMawPct < 25) {
    alerts.push({
      id: "representation_non_mawhiba",
      category: "representation_gap",
      severity: nonMawPct < 15 ? "critical" : "warning",
      titleAr: "ضعف تمثيل غير الموهبة",
      titleEn: "Low non-Mawhiba representation",
      bodyAr: `طلاب غير الموهبة يمثلون ${nonMawPct}% فقط من المشاركات.`,
      bodyEn: `Non-Mawhiba students represent only ${nonMawPct}% of participations.`,
      priority: 80,
      trace: trace("representation_non_mawhiba", perspective, "table", ["mawhiba"], ["mawhibaSplit", "table"], "non-mawhiba row sum / table sum"),
      drillSource: "mawhiba_bar",
      drillPayload: { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba" },
    });
  }

  const concentrations = buildActivityConcentrationIntelligence(table, 5);
  for (const c of concentrations) {
    if (c.dominantPct >= 75) {
      alerts.push({
        id: `concentration_${c.activityKey}`,
        category: "opportunity_concentration",
        severity: c.dominantPct >= 82 ? "critical" : "warning",
        titleAr: "تركز النشاط",
        titleEn: "Activity concentration",
        bodyAr: `${c.labelAr} يتركز بنسبة ${c.dominantPct}% داخل ${c.dominantLabelAr}.`,
        bodyEn: `${c.labelEn} is ${c.dominantPct}% concentrated in ${c.dominantLabelEn}.`,
        priority: 76,
        trace: trace(`concentration_${c.activityKey}`, perspective, "table", ["activity", c.dominantKind], ["table"], "row demographic dominance"),
        drillSource: "activity_row",
        drillPayload: {
          activityKey: c.activityKey,
          key: c.activityKey,
          labelAr: c.labelAr,
          labelEn: c.labelEn,
        },
      });
    }
  }

  const female = data.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0;
  const male = data.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0;
  const girlsPct = pct(female, male + female);
  if (girlsPct < 40 && male + female > 0) {
    alerts.push({
      id: "diversity_girls_low",
      category: "diversity_warning",
      severity: girlsPct < 32 ? "critical" : "warning",
      titleAr: "ضعف تمثيل البنات",
      titleEn: "Low girls representation",
      bodyAr: `تمثيل البنات ${girlsPct}% — أقل من التوازن المتوقع.`,
      bodyEn: `Girls representation ${girlsPct}% — below expected balance.`,
      priority: 74,
      trace: trace("diversity_girls_low", perspective, "charts", ["gender"], ["genderParticipation"], "female / (male+female)"),
      drillSource: "gender_bar",
      drillPayload: { key: "female", labelAr: "بنات", labelEn: "Girls" },
    });
  }

  const arSection = data.charts.sectionParticipation.find((x) => x.key === "arabic");
  const intlSection = data.charts.sectionParticipation.find((x) => x.key === "international");
  if (arSection && intlSection && arSection.count > intlSection.count * 2) {
    alerts.push({
      id: "participation_section_imbalance",
      category: "participation_imbalance",
      severity: "info",
      titleAr: "فجوة مشاركة بين القسمين",
      titleEn: "Section participation gap",
      bodyAr: `فجوة مشاركة واضحة: عربي ${arSection.count} مقابل دولي ${intlSection.count}.`,
      bodyEn: `Clear participation gap: Arabic ${arSection.count} vs International ${intlSection.count}.`,
      priority: 70,
      trace: trace("participation_section_imbalance", perspective, "charts", ["section"], ["sectionParticipation"], "arabic vs international counts"),
      drillSource: "section_bar",
      drillPayload: { key: "arabic", labelAr: arSection.labelAr, labelEn: arSection.labelEn },
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority);
};

export const buildOpportunityRecommendations = (
  concentrations: ActivityConcentrationRow[]
): OpportunityRecommendation[] =>
  concentrations.slice(0, 5).map((c, i) => ({
    id: `rec_${c.activityKey}`,
    bodyAr: c.recommendationAr,
    bodyEn: c.recommendationEn,
    priority: 65 - i,
    relatedActivityKey: c.activityKey,
  }));

export const buildOpportunityNarratives = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): OpportunityIntelligenceBundle["narratives"] => {
  const narratives: OpportunityIntelligenceBundle["narratives"] = [];
  const gaps = detectOpportunityGaps(data, perspective);

  const sectionGap = gaps.find((g) => g.id === "representation_section");
  if (sectionGap && sectionGap.gapValue >= 12) {
    narratives.push({
      id: "opp_section_gap",
      bodyAr: "هناك فجوة مشاركة واضحة بين القسمين العربي والدولي.",
      bodyEn: "There is a clear participation gap between Arabic and International sections.",
      severity: sectionGap.severity,
      priority: 77,
    });
  }

  const lowestLevel = [...data.charts.levelDistribution].sort((a, b) => a.count - b.count)[0];
  const trainingRows = data.table.filter((r) =>
    /training|تدريب|workshop|ورشة/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  if (lowestLevel && trainingRows.length > 0) {
    narratives.push({
      id: "opp_secondary_training",
      bodyAr: `${lowestLevel.labelAr} الأقل تمثيلًا في البرامج التدريبية.`,
      bodyEn: `${lowestLevel.labelEn} is least represented in training programs.`,
      severity: "warning",
      priority: 72,
    });
  }

  const mawRows = data.table.reduce((s, r) => s + r.mawhibaParticipants, 0);
  const intlRows = data.table.reduce((s, r) => s + r.internationalParticipants, 0);
  const totalR = data.table.reduce((s, r) => s + r.totalParticipations, 0);
  if (totalR > 0 && mawRows / totalR >= 0.55 && intlRows / totalR >= 0.4) {
    narratives.push({
      id: "opp_mawhiba_intl",
      bodyAr: "طلاب الموهبة يهيمنون على المشاركات الدولية.",
      bodyEn: "Mawhiba students dominate international participations.",
      severity: "warning",
      priority: 68,
    });
  }

  const femaleStack = data.charts.genderResultStack.find((x) => x.gender === "female");
  const femaleP = data.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0;
  const maleP = data.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0;
  if (femaleStack && femaleP > 0 && maleP > 0) {
    const fMed = femaleStack.gold + femaleStack.silver + femaleStack.bronze;
    const fRate = pct(fMed, femaleP);
    const girlsRep = pct(femaleP, femaleP + maleP);
    if (fRate > 15 && girlsRep < 45) {
      narratives.push({
        id: "opp_girls_conversion_rep",
        bodyAr: "البنات يمتلكن أفضل معدل تحويل لكن تمثيلهن أقل.",
        bodyEn: "Girls show stronger conversion rates but lower overall representation.",
        severity: "info",
        priority: 66,
      });
    }
  }

  return narratives.sort((a, b) => b.priority - a.priority);
};

export const buildOpportunityIntelligence = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective = "participation"
): OpportunityIntelligenceBundle => {
  const { score, tier } = computeOpportunityScore(data, perspective);
  const gaps = detectOpportunityGaps(data, perspective);
  const alerts = buildOpportunityAlerts(data, perspective);
  const heatmap = buildOpportunityHeatmap(data, perspective);
  const concentrations = buildActivityConcentrationIntelligence(data.table, 8);
  const recommendations = buildOpportunityRecommendations(concentrations);
  const narratives = buildOpportunityNarratives(data, perspective);

  const activeLevels = data.charts.levelDistribution.filter((x) => x.count > 0).length;
  const activeActivities = data.table.filter((r) => r.totalParticipations > 0).length;
  const participationSpread =
    activeLevels > 0
      ? Math.round((activeActivities / Math.max(1, data.table.length)) * 100)
      : 0;

  return {
    opportunityScore: score,
    tier,
    alerts,
    gaps,
    heatmap,
    concentrations,
    recommendations,
    narratives,
    spread: {
      activityCount: activeActivities,
      levelCount: activeLevels,
      participationSpread,
    },
  };
};

/** Opportunity comparison deltas — extends comparison workspace semantics */
export type OpportunityComparisonDelta = {
  key: "representation" | "access" | "diversity" | "concentration" | "spread";
  labelAr: string;
  labelEn: string;
  valueA: number;
  valueB: number;
  delta: number;
};

export const buildOpportunityComparisonDeltas = (
  data: ParticipationAnalyticsPayload,
  sideAKey: string,
  sideBKey: string,
  dimension: "section" | "gender" | "mawhiba"
): OpportunityComparisonDelta[] => {
  const pick = (key: string) => {
    if (dimension === "section") {
      return data.charts.sectionParticipation.find((x) => x.key === key)?.count ?? 0;
    }
    if (dimension === "gender") {
      return data.charts.genderParticipation.find((x) => x.key === key)?.count ?? 0;
    }
    return data.charts.mawhibaSplit.find((x) => x.key === key)?.count ?? 0;
  };
  const a = pick(sideAKey);
  const b = pick(sideBKey);
  const total = a + b || 1;
  const repA = pct(a, total);
  const repB = pct(b, total);
  const conc = buildActivityConcentrationIntelligence(data.table, 1)[0]?.dominantPct ?? 0;

  return [
    {
      key: "representation",
      labelAr: "فرق التمثيل",
      labelEn: "Representation delta",
      valueA: repA,
      valueB: repB,
      delta: Math.round((repA - repB) * 10) / 10,
    },
    {
      key: "access",
      labelAr: "فرق الوصول",
      labelEn: "Access delta",
      valueA: a,
      valueB: b,
      delta: a - b,
    },
    {
      key: "diversity",
      labelAr: "فرق التنوع",
      labelEn: "Diversity delta",
      valueA: repA,
      valueB: 100 - repA,
      delta: Math.abs(repA - 50),
    },
    {
      key: "concentration",
      labelAr: "فرق التركز",
      labelEn: "Concentration delta",
      valueA: conc,
      valueB: 100 - conc,
      delta: conc,
    },
    {
      key: "spread",
      labelAr: "انتشار الفرص",
      labelEn: "Opportunity spread delta",
      valueA: data.table.filter((r) => r.totalParticipations > 0).length,
      valueB: data.charts.levelDistribution.filter((x) => x.count > 0).length,
      delta:
        data.table.filter((r) => r.totalParticipations > 0).length -
        data.charts.levelDistribution.filter((x) => x.count > 0).length,
    },
  ];
};

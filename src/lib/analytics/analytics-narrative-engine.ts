/**
 * Executive narrative engine — deterministic, filter-aware insights from canonical analytics.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsCanonicalSnapshot } from "@/lib/analytics/analytics-canonical-snapshot";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { computeMedalConversionRate } from "@/lib/analytics/analytics-metrics-definitions";
import {
  buildParticipationCountingSnapshot,
} from "@/lib/analytics/analytics-counting-contract";
import {
  computeAvgParticipationsPerStudent,
  type AnalyticsLocale,
} from "@/lib/analytics/analytics-semantic-registry";
import {
  INSIGHT_REGISTRY,
  THRESHOLDS,
  applyInsightTemplate,
  type InsightRegistryId,
} from "@/lib/analytics/analytics-insight-registry";
import {
  resolveAnalyticsCompetitionScope,
  shouldShowInternationalAchievementKpi,
} from "@/lib/analytics/analytics-relevance";
import { buildAnalyticsInsights, type AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import { buildActivityDemographicBreakdowns } from "@/lib/analytics/analytics-demographic-intelligence";
import { buildOpportunityNarratives } from "@/lib/analytics/analytics-opportunity-intelligence";
import { buildRecommendationNarratives, buildEducationalRecommendations } from "@/lib/analytics/analytics-recommendation-engine";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { scaleSliceToPerspective } from "@/lib/analytics/analytics-perspective";
import { buildStrategicNarratives } from "@/lib/analytics/analytics-strategic-narratives";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";

export type NarrativeCategory =
  | "executive"
  | "comparative"
  | "trend"
  | "medal"
  | "participation"
  | "section"
  | "opportunity"
  | "recommendation";

export type ExecutiveNarrative = {
  id: string;
  registryId?: InsightRegistryId;
  category: NarrativeCategory;
  priority: number;
  severity: "info" | "warn" | "critical";
  confidence: number;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  metricKeys: string[];
};

export type AnalyticsNarrativeBundle = {
  narratives: ExecutiveNarrative[];
  legacyInsights: AnalyticsInsightsBundle;
  hasData: boolean;
};

const pushNarrative = (
  list: ExecutiveNarrative[],
  row: ExecutiveNarrative
): void => {
  list.push(row);
};

export const buildAnalyticsNarratives = (input: {
  snapshot: AnalyticsCanonicalSnapshot;
  general: ParticipationAnalyticsPayload | null;
  focused: FocusedActivityReportPayload | null;
  filters: ExecutiveFilterSnapshot;
  intelScope?: "lite" | "full";
  perspective?: AnalyticsCountPerspective;
  historicalSlices?: HistoricalYearSlice[];
}): AnalyticsNarrativeBundle => {
  const perspective = input.perspective ?? "participation";
  const legacyInsights = buildAnalyticsInsights({
    snapshot: input.snapshot,
    general: input.general,
    focused: input.focused,
  });

  const narratives: ExecutiveNarrative[] = [];
  const table = input.general?.table ?? [];
  const g = input.general;
  if (!g || input.snapshot.totalParticipations <= 0) {
    return { narratives: [], legacyInsights, hasData: false };
  }

  const loc: AnalyticsLocale = "ar";
  const counts = buildParticipationCountingSnapshot(g);
  const scope = resolveAnalyticsCompetitionScope(input.filters);
  const showIntl = shouldShowInternationalAchievementKpi(
    scope,
    g.kpis.internationalAchievementPct,
    g.kpis.internationalSectionPct
  );
  const medalRate = computeMedalConversionRate(g);
  const avgPerStudent = computeAvgParticipationsPerStudent(
    counts.participationCount,
    counts.uniqueStudentsCount
  );

  if (avgPerStudent >= THRESHOLDS.avgParticipationsPerStudentHigh) {
    const reg = INSIGHT_REGISTRY.participation_per_student_high;
    pushNarrative(narratives, {
      id: reg.id,
      registryId: reg.id,
      category: "participation",
      priority: reg.priority,
      severity: reg.defaultSeverity,
      confidence: 0.85,
      titleAr: reg.title.ar,
      titleEn: reg.title.en,
      bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, {
        avg: avgPerStudent,
        total: counts.participationCount,
        students: counts.uniqueStudentsCount,
      }),
      bodyEn: applyInsightTemplate(reg.bodyTemplate.en, {
        avg: avgPerStudent,
        total: counts.participationCount,
        students: counts.uniqueStudentsCount,
      }),
      metricKeys: reg.metricKeys,
    });
  }

  if (medalRate >= THRESHOLDS.medalConversionHighPct) {
    const reg = INSIGHT_REGISTRY.medal_density_high;
    pushNarrative(narratives, {
      id: reg.id,
      registryId: reg.id,
      category: "medal",
      priority: reg.priority,
      severity: reg.defaultSeverity,
      confidence: 0.8,
      titleAr: reg.title.ar,
      titleEn: reg.title.en,
      bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, { rate: medalRate }),
      bodyEn: applyInsightTemplate(reg.bodyTemplate.en, { rate: medalRate }),
      metricKeys: reg.metricKeys,
    });
  }

  const topActivityAr = g.kpis.topProgramLabelAr;
  const topActivityEn = g.kpis.topProgramLabelEn;
  if (topActivityAr && medalRate > 0) {
    const reg = INSIGHT_REGISTRY.kangaroo_conversion_leader;
    pushNarrative(narratives, {
      id: `${reg.id}_${topActivityEn}`,
      registryId: reg.id,
      category: "medal",
      priority: reg.priority,
      severity: reg.defaultSeverity,
      confidence: 0.78,
      titleAr: reg.title.ar,
      titleEn: reg.title.en,
      bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, {
        activity: topActivityAr,
        rate: medalRate,
      }),
      bodyEn: applyInsightTemplate(reg.bodyTemplate.en, {
        activity: topActivityEn,
        rate: medalRate,
      }),
      metricKeys: reg.metricKeys,
    });
  }

  const sectionRows = g.charts.sectionParticipation;
  const sectionTotal = sectionRows.reduce((s, x) => s + x.count, 0);
  const arabic = sectionRows.find((x) => x.key === "arabic" || x.labelEn?.toLowerCase().includes("arabic"));
  if (sectionTotal > 0 && arabic) {
    const pct = Math.round((arabic.count / sectionTotal) * 1000) / 10;
    if (pct >= THRESHOLDS.sectionLeadPct) {
      const reg = INSIGHT_REGISTRY.arabic_section_leads;
      pushNarrative(narratives, {
        id: reg.id,
        registryId: reg.id,
        category: "section",
        priority: reg.priority,
        severity: reg.defaultSeverity,
        confidence: 0.76,
        titleAr: reg.title.ar,
        titleEn: reg.title.en,
        bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, { pct }),
        bodyEn: applyInsightTemplate(reg.bodyTemplate.en, { pct }),
        metricKeys: reg.metricKeys,
      });
    }
  }

  const mawhibaRows = g.charts.mawhibaSplit;
  const mawTotal = mawhibaRows.reduce((s, x) => s + x.count, 0);
  const mawYes = mawhibaRows.find((x) => x.key === "yes" || x.labelEn?.toLowerCase().includes("mawhiba"));
  if (mawTotal > 0 && mawYes) {
    const pct = Math.round((mawYes.count / mawTotal) * 1000) / 10;
    if (pct >= THRESHOLDS.mawhibaMajorityPct) {
      const reg = INSIGHT_REGISTRY.mawhiba_medal_majority;
      pushNarrative(narratives, {
        id: reg.id,
        registryId: reg.id,
        category: "section",
        priority: reg.priority,
        severity: reg.defaultSeverity,
        confidence: 0.74,
        titleAr: reg.title.ar,
        titleEn: reg.title.en,
        bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, { pct }),
        bodyEn: applyInsightTemplate(reg.bodyTemplate.en, { pct }),
        metricKeys: reg.metricKeys,
      });
    }
  }

  if (g.charts.yearTrend.length >= 2) {
    const sorted = [...g.charts.yearTrend].sort((a, b) => a.year - b.year);
    const last = sorted[sorted.length - 1]!;
    const prev = sorted[sorted.length - 2]!;
    if (prev.totalRows > 0) {
      const yoy = Math.round(((last.totalRows - prev.totalRows) / prev.totalRows) * 100);
      if (yoy >= THRESHOLDS.yoySpikePct) {
        const reg = INSIGHT_REGISTRY.yearly_participation_spike;
        pushNarrative(narratives, {
          id: reg.id,
          registryId: reg.id,
          category: "trend",
          priority: reg.priority,
          severity: reg.defaultSeverity,
          confidence: 0.82,
          titleAr: reg.title.ar,
          titleEn: reg.title.en,
          bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, {
            pct: yoy,
            prevYear: prev.year,
            lastYear: last.year,
          }),
          bodyEn: applyInsightTemplate(reg.bodyTemplate.en, {
            pct: yoy,
            prevYear: prev.year,
            lastYear: last.year,
          }),
          metricKeys: reg.metricKeys,
        });
      } else if (yoy <= THRESHOLDS.yoyDropPct) {
        const reg = INSIGHT_REGISTRY.participation_drop_alert;
        pushNarrative(narratives, {
          id: reg.id,
          registryId: reg.id,
          category: "trend",
          priority: reg.priority,
          severity: reg.defaultSeverity,
          confidence: 0.8,
          titleAr: reg.title.ar,
          titleEn: reg.title.en,
          bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, {
            pct: Math.abs(yoy),
            prevYear: prev.year,
            lastYear: last.year,
          }),
          bodyEn: applyInsightTemplate(reg.bodyTemplate.en, {
            pct: Math.abs(yoy),
            prevYear: prev.year,
            lastYear: last.year,
          }),
          metricKeys: reg.metricKeys,
        });
      }
    }
  }

  const topActivity = [...table].sort((a, b) => b.totalParticipations - a.totalParticipations)[0];
  const topLevel = [...g.charts.levelDistribution].sort((a, b) => b.count - a.count)[0];
  if (topActivity && topLevel && topLevel.count > 0) {
    const reg = INSIGHT_REGISTRY.grade_band_leads_activity;
    const levelCount = scaleSliceToPerspective(topLevel.count, g, perspective);
    pushNarrative(narratives, {
      id: reg.id,
      registryId: reg.id,
      category: "comparative",
      priority: reg.priority,
      severity: reg.defaultSeverity,
      confidence: 0.7,
      titleAr: reg.title.ar,
      titleEn: reg.title.en,
      bodyAr:
        perspective === "student"
          ? `${topLevel.labelAr}: طلاب القسم يقودون ${topActivity.activityLabelAr} (${levelCount} طالب في المستوى).`
          : applyInsightTemplate(reg.bodyTemplate.ar, {
              grade: topLevel.labelAr,
              activity: topActivity.activityLabelAr,
              count: topActivity.totalParticipations,
            }),
      bodyEn:
        perspective === "student"
          ? `${topLevel.labelEn}: students in this band lead ${topActivity.activityLabelEn} (${levelCount} students).`
          : applyInsightTemplate(reg.bodyTemplate.en, {
              grade: topLevel.labelEn,
              activity: topActivity.activityLabelEn,
              count: topActivity.totalParticipations,
            }),
      metricKeys: reg.metricKeys,
    });
  }

  const arSlice = g.charts.sectionParticipation.find((x) => x.key === "arabic");
  const intlSlice = g.charts.sectionParticipation.find((x) => x.key === "international");
  if (perspective === "student" && arSlice && intlSlice) {
    pushNarrative(narratives, {
      id: "perspective_students_section_lead",
      category: "section",
      priority: 74,
      severity: "info",
      confidence: 0.68,
      titleAr: "قيادة الطلاب حسب القسم",
      titleEn: "Students lead by section",
      bodyAr: `طلاب ${intlSlice.count >= arSlice.count ? intlSlice.labelAr : arSlice.labelAr} يقودون المشاركة (${Math.max(intlSlice.count, arSlice.count)} طالب ممثل).`,
      bodyEn: `${intlSlice.count >= arSlice.count ? intlSlice.labelEn : arSlice.labelEn} students lead participation representation.`,
      metricKeys: ["sectionParticipation"],
    });
  } else if (perspective === "participation" && arSlice && intlSlice && arSlice.count > intlSlice.count) {
    pushNarrative(narratives, {
      id: "perspective_arabic_density",
      category: "section",
      priority: 71,
      severity: "info",
      confidence: 0.66,
      titleAr: "كثافة المشاركات",
      titleEn: "Participation density",
      bodyAr: `القسم العربي يمتلك أعلى كثافة مشاركات (${arSlice.count} مقابل ${intlSlice.count} دولي).`,
      bodyEn: `Arabic section has higher participation density (${arSlice.count} vs ${intlSlice.count} international).`,
      metricKeys: ["sectionParticipation"],
    });
  }

  const femaleStack = g.charts.genderResultStack.find((x) => x.gender === "female");
  const maleStack = g.charts.genderResultStack.find((x) => x.gender === "male");
  const femaleP = g.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0;
  const maleP = g.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0;
  if (femaleStack && maleStack && femaleP > 0 && maleP > 0) {
    const fMed = femaleStack.gold + femaleStack.silver + femaleStack.bronze;
    const mMed = maleStack.gold + maleStack.silver + maleStack.bronze;
    const fRate = Math.round((fMed / femaleP) * 1000) / 10;
    const mRate = Math.round((mMed / maleP) * 1000) / 10;
    if (fRate > mRate + 5) {
      const reg = INSIGHT_REGISTRY.girls_medal_conversion_lead;
      pushNarrative(narratives, {
        id: reg.id,
        registryId: reg.id,
        category: "comparative",
        priority: reg.priority,
        severity: reg.defaultSeverity,
        confidence: 0.66,
        titleAr: reg.title.ar,
        titleEn: reg.title.en,
        bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, { rate: fRate, maleRate: mRate }),
        bodyEn: applyInsightTemplate(reg.bodyTemplate.en, { rate: fRate, maleRate: mRate }),
        metricKeys: reg.metricKeys,
      });
    }
  }

  const mawYesCount = mawhibaRows.find((x) => x.key === "yes")?.count ?? 0;
  const olympiadLike = table.filter(
    (r) => /olympiad|أولمبياد|bebras|بيبراس|mawhiba|موهبة/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const olympiadP = olympiadLike.reduce((s, r) => s + r.totalParticipations, 0);
  if (mawTotal > 0 && olympiadP > 0 && mawYesCount / mawTotal >= 0.5) {
    const reg = INSIGHT_REGISTRY.mawhiba_olympiad_majority;
    const pctMaw = Math.round((mawYesCount / mawTotal) * 1000) / 10;
    pushNarrative(narratives, {
      id: reg.id,
      registryId: reg.id,
      category: "section",
      priority: reg.priority,
      severity: reg.defaultSeverity,
      confidence: 0.64,
      titleAr: reg.title.ar,
      titleEn: reg.title.en,
      bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, { pct: pctMaw }),
      bodyEn: applyInsightTemplate(reg.bodyTemplate.en, { pct: pctMaw }),
      metricKeys: reg.metricKeys,
    });
  }

  const activityBreakdowns = buildActivityDemographicBreakdowns(table, 1)[0];
  if (activityBreakdowns && activityBreakdowns.participations > 0) {
    pushNarrative(narratives, {
      id: "activity_top_cohort",
      category: "executive",
      priority: 58,
      severity: "info",
      confidence: 0.72,
      titleAr: `بروز ${activityBreakdowns.labelAr}`,
      titleEn: `${activityBreakdowns.labelEn} cohort signal`,
      bodyAr: `${activityBreakdowns.labelAr}: عربي ${activityBreakdowns.bySection.arabic} · دولي ${activityBreakdowns.bySection.international} · بنين ${activityBreakdowns.byGender.male} · بنات ${activityBreakdowns.byGender.female} · موهبة ${activityBreakdowns.byMawhiba.mawhiba}.`,
      bodyEn: `${activityBreakdowns.labelEn}: Arabic ${activityBreakdowns.bySection.arabic} · Intl ${activityBreakdowns.bySection.international} · Boys ${activityBreakdowns.byGender.male} · Girls ${activityBreakdowns.byGender.female} · Mawhiba ${activityBreakdowns.byMawhiba.mawhiba}.`,
      metricKeys: ["activityDemographics"],
    });
  }

  if (showIntl && g.kpis.internationalSectionPct >= THRESHOLDS.intlNotablePct) {
    const reg = INSIGHT_REGISTRY.international_presence_notable;
    pushNarrative(narratives, {
      id: reg.id,
      registryId: reg.id,
      category: "comparative",
      priority: reg.priority,
      severity: reg.defaultSeverity,
      confidence: 0.7,
      titleAr: reg.title.ar,
      titleEn: reg.title.en,
      bodyAr: applyInsightTemplate(reg.bodyTemplate.ar, { pct: g.kpis.internationalSectionPct }),
      bodyEn: applyInsightTemplate(reg.bodyTemplate.en, { pct: g.kpis.internationalSectionPct }),
      metricKeys: reg.metricKeys,
    });
  }

  for (const opp of buildOpportunityNarratives(g, perspective)) {
    const oppSeverity: ExecutiveNarrative["severity"] =
      opp.severity === "warning" ? "warn" : opp.severity === "critical" ? "critical" : "info";
    pushNarrative(narratives, {
      id: opp.id,
      category: "opportunity",
      priority: opp.priority,
      severity: oppSeverity,
      confidence: 0.7,
      titleAr: opp.bodyAr.slice(0, 48),
      titleEn: opp.bodyEn.slice(0, 48),
      bodyAr: opp.bodyAr,
      bodyEn: opp.bodyEn,
      metricKeys: ["opportunityIntelligence"],
    });
  }

  const recBundle = buildEducationalRecommendations(g, perspective);
  for (const rn of buildRecommendationNarratives(recBundle.recommendations).slice(0, 3)) {
    const recSeverity: ExecutiveNarrative["severity"] =
      rn.severity === "critical" ? "critical" : rn.severity === "high" ? "warn" : "info";
    pushNarrative(narratives, {
      id: rn.id,
      category: "recommendation",
      priority: 55,
      severity: recSeverity,
      confidence: 0.68,
      titleAr: rn.bodyAr.slice(0, 40),
      titleEn: rn.bodyEn.slice(0, 40),
      bodyAr: rn.bodyAr,
      bodyEn: rn.bodyEn,
      metricKeys: ["recommendationIntelligence"],
    });
  }

  for (const sn of buildStrategicNarratives({
    general: g,
    historicalSlices: input.historicalSlices,
  }).slice(0, 4)) {
    pushNarrative(narratives, {
      id: `strategic_${sn.id}`,
      category: sn.category === "trend" ? "trend" : sn.category === "funnel" ? "recommendation" : "executive",
      priority: sn.priority,
      severity: sn.severity,
      confidence: 0.75,
      titleAr: sn.bodyAr.slice(0, 56),
      titleEn: sn.bodyEn.slice(0, 56),
      bodyAr: sn.bodyAr,
      bodyEn: sn.bodyEn,
      metricKeys: sn.metricIds,
    });
  }

  for (const ins of legacyInsights.insights) {
    pushNarrative(narratives, {
      id: `legacy_${ins.id}`,
      category: "executive",
      priority: 40,
      severity: ins.severity,
      confidence: ins.confidence,
      titleAr: ins.titleAr,
      titleEn: ins.titleEn,
      bodyAr: ins.bodyAr,
      bodyEn: ins.bodyEn,
      metricKeys: ins.metricKeys,
    });
  }

  narratives.sort((a, b) => b.priority - a.priority);

  return {
    narratives: narratives.slice(0, 8),
    legacyInsights,
    hasData: true,
  };
};

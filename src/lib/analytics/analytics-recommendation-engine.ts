/**
 * Educational recommendation intelligence — actionable decisions from opportunity, equity, participation (client layer).
 */

import type {
  ParticipationActivityRow,
  ParticipationAnalyticsPayload,
} from "@/lib/achievement-participation-analytics";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { buildEquityIntelligence } from "@/lib/analytics/analytics-equity-intelligence";
import {
  buildOpportunityIntelligence,
  buildOpportunityHeatmap,
  type OpportunityHeatmapCell,
} from "@/lib/analytics/analytics-opportunity-intelligence";
import { buildActivityConcentrationIntelligence } from "@/lib/analytics/activity-concentration-intelligence";
import {
  buildTalentDiscoveryRecommendations,
  buildTalentDiscoverySignals,
} from "@/lib/analytics/talent-discovery-intelligence";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type RecommendationType =
  | "expansion"
  | "targeting"
  | "equity"
  | "diversity"
  | "participation"
  | "talent-discovery"
  | "engagement"
  | "concentration-reduction"
  | "access-improvement";

export type RecommendationSeverity = "info" | "moderate" | "high" | "critical";

export type RecommendationUiCategory =
  | "participation"
  | "equity"
  | "diversity"
  | "expansion"
  | "talent"
  | "representation";

export type RecommendationUrgency = "low" | "medium" | "high";

export type RecommendationTraceMeta = {
  recommendationId: string;
  sourceDatasets: Array<"charts" | "table" | "kpis" | "opportunity" | "equity" | "comparison" | "trend">;
  triggeringMetrics: string[];
  demographicBasis: string[];
  comparisonBasis?: string;
  opportunityFactors: string[];
  confidenceExplanationAr: string;
  confidenceExplanationEn: string;
  perspective: AnalyticsCountPerspective;
};

export type EducationalRecommendation = {
  id: string;
  type: RecommendationType;
  uiCategory: RecommendationUiCategory;
  severity: RecommendationSeverity;
  urgency: RecommendationUrgency;
  confidence: number;
  opportunityImpact: number;
  equityImpact: number;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  reasonAr: string;
  reasonEn: string;
  targetCohortAr: string;
  targetCohortEn: string;
  relatedActivityKey?: string;
  relatedActivityLabelAr?: string;
  relatedActivityLabelEn?: string;
  supportingMetrics: Array<{ labelAr: string; labelEn: string; value: string }>;
  priority: number;
  trace: RecommendationTraceMeta;
  drillSource: DrillChartSource;
  drillPayload: {
    key?: string;
    labelAr?: string;
    labelEn?: string;
    activityKey?: string;
  };
};

export type RecommendationNarrative = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  severity: RecommendationSeverity;
};

export type RecommendationIntelligenceBundle = {
  recommendationScore: number;
  recommendations: EducationalRecommendation[];
  narratives: RecommendationNarrative[];
  heatmap: OpportunityHeatmapCell[];
  byCategory: Record<RecommendationUiCategory, EducationalRecommendation[]>;
  talentCount: number;
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

const gapToSeverity = (gap: number): RecommendationSeverity => {
  if (gap >= 28) return "critical";
  if (gap >= 18) return "high";
  if (gap >= 10) return "moderate";
  return "info";
};

const severityToUrgency = (s: RecommendationSeverity): RecommendationUrgency => {
  if (s === "critical") return "high";
  if (s === "high") return "high";
  if (s === "moderate") return "medium";
  return "low";
};

const severityImpact = (s: RecommendationSeverity): number => {
  const map: Record<RecommendationSeverity, number> = {
    info: 35,
    moderate: 55,
    high: 75,
    critical: 92,
  };
  return map[s];
};

const makeTrace = (
  id: string,
  perspective: AnalyticsCountPerspective,
  sources: RecommendationTraceMeta["sourceDatasets"],
  metrics: string[],
  demo: string[],
  oppFactors: string[],
  confAr: string,
  confEn: string
): RecommendationTraceMeta => ({
  recommendationId: id,
  sourceDatasets: sources,
  triggeringMetrics: metrics,
  demographicBasis: demo,
  opportunityFactors: oppFactors,
  confidenceExplanationAr: confAr,
  confidenceExplanationEn: confEn,
  perspective,
});

const pushRec = (
  list: EducationalRecommendation[],
  rec: EducationalRecommendation
): void => {
  list.push(rec);
};

export const computeRecommendationScore = (recs: EducationalRecommendation[]): number => {
  if (recs.length === 0) return 100;
  const avgImpact =
    recs.reduce((s, r) => s + (r.opportunityImpact + r.equityImpact) / 2, 0) / recs.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgImpact * 0.85)));
};

const typeToUiCategory = (type: RecommendationType): RecommendationUiCategory => {
  const map: Record<RecommendationType, RecommendationUiCategory> = {
    participation: "participation",
    equity: "equity",
    "access-improvement": "equity",
    diversity: "diversity",
    engagement: "diversity",
    expansion: "expansion",
    "talent-discovery": "talent",
    targeting: "representation",
    "concentration-reduction": "representation",
  };
  return map[type];
};

export const buildParticipationRecommendations = (
  data: ParticipationAnalyticsPayload,
  table: ParticipationActivityRow[],
  perspective: AnalyticsCountPerspective
): EducationalRecommendation[] => {
  const recs: EducationalRecommendation[] = [];
  const lowestLevel = [...data.charts.levelDistribution].sort((a, b) => a.count - b.count)[0];
  const olympiadRows = table.filter((r) =>
    /olympiad|أولمبياد|bebras|بيبراس/i.test(r.activityLabelEn + r.activityLabelAr)
  );

  if (lowestLevel && olympiadRows.length > 0) {
    const sev = gapToSeverity(Math.max(15, 50 - pct(lowestLevel.count, data.kpis.totalParticipations)));
    pushRec(recs, {
      id: "rec_part_olympiad_level",
      type: "participation",
      uiCategory: "participation",
      severity: sev,
      urgency: severityToUrgency(sev),
      confidence: 0.78,
      opportunityImpact: severityImpact(sev),
      equityImpact: 55,
      titleAr: "توسيع مشاركة الأولمبيادات",
      titleEn: "Expand olympiad participation",
      bodyAr: `يوصى بزيادة مشاركة ${lowestLevel.labelAr} في الأولمبيادات والمسابقات العلمية.`,
      bodyEn: `Increase ${lowestLevel.labelEn} participation in olympiads and science competitions.`,
      reasonAr: `أقل مستوى تمثيل (${lowestLevel.count} مشاركة) مقارنة بالنطاق.`,
      reasonEn: `Lowest level representation (${lowestLevel.count}) under current filters.`,
      targetCohortAr: lowestLevel.labelAr,
      targetCohortEn: lowestLevel.labelEn,
      relatedActivityKey: olympiadRows[0]?.activityKey,
      relatedActivityLabelAr: olympiadRows[0]?.activityLabelAr,
      relatedActivityLabelEn: olympiadRows[0]?.activityLabelEn,
      supportingMetrics: [
        { labelAr: "مشاركات المستوى", labelEn: "Level participations", value: String(lowestLevel.count) },
      ],
      priority: 85,
      trace: makeTrace(
        "rec_part_olympiad_level",
        perspective,
        ["charts", "table", "opportunity"],
        ["levelDistribution", "activityHorizontal"],
        ["level"],
        ["access_gap", "participation_gap"],
        "مقارنة توزيع المستويات مع أنشطة الأولمبياد.",
        "Level distribution vs olympiad activity rows."
      ),
      drillSource: "section_bar",
      drillPayload: {
        key: lowestLevel.labelEn || lowestLevel.labelAr,
        labelAr: lowestLevel.labelAr,
        labelEn: lowestLevel.labelEn,
      },
    });
  }

  const intl = data.charts.sectionParticipation.find((x) => x.key === "international");
  const sciRows = table.filter((r) =>
    /science|علم|olympiad|أولمبياد|robot|روبوت/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const intlSci = sciRows.reduce((s, r) => s + r.internationalParticipants, 0);
  const sciP = sciRows.reduce((s, r) => s + r.totalParticipations, 0);
  if (intl && sciP > 0 && pct(intlSci, sciP) < 40) {
    const sev = gapToSeverity(40 - pct(intlSci, sciP));
    pushRec(recs, {
      id: "rec_part_intl_science",
      type: "participation",
      uiCategory: "participation",
      severity: sev,
      urgency: severityToUrgency(sev),
      confidence: 0.74,
      opportunityImpact: severityImpact(sev),
      equityImpact: 60,
      titleAr: "تعزيز المشاركة العلمية — دولي",
      titleEn: "Boost intl. science participation",
      bodyAr: "القسم الدولي يحتاج إلى تعزيز المشاركة العلمية والمسابقات التقنية.",
      bodyEn: "International section needs stronger science and technical competition participation.",
      reasonAr: `تمثيل دولي ${pct(intlSci, sciP)}% فقط ضمن الأنشطة العلمية.`,
      reasonEn: `Only ${pct(intlSci, sciP)}% international share in science activities.`,
      targetCohortAr: intl.labelAr,
      targetCohortEn: intl.labelEn,
      supportingMetrics: [
        { labelAr: "مشاركات علمية", labelEn: "Science participations", value: String(sciP) },
      ],
      priority: 82,
      trace: makeTrace(
        "rec_part_intl_science",
        perspective,
        ["table", "charts"],
        ["sectionParticipation", "internationalParticipants"],
        ["section", "activity"],
        ["representation_gap"],
        "مجموع المشاركات الدولية في صفوف الأنشطة العلمية.",
        "Sum of international participants in science activity rows."
      ),
      drillSource: "section_bar",
      drillPayload: { key: "international", labelAr: intl.labelAr, labelEn: intl.labelEn },
    });
  }

  const satRow = table.find((r) => /sat|ielts|تحصيلي|قدرات/i.test(r.activityLabelEn + r.activityLabelAr));
  const arSection = data.charts.sectionParticipation.find((x) => x.key === "arabic");
  if (satRow && arSection && satRow.arabicParticipants < satRow.internationalParticipants) {
    pushRec(recs, {
      id: "rec_part_ar_sat",
      type: "participation",
      uiCategory: "participation",
      severity: "moderate",
      urgency: "medium",
      confidence: 0.7,
      opportunityImpact: 58,
      equityImpact: 52,
      titleAr: "كثافة SAT — القسم العربي",
      titleEn: "SAT density — Arabic section",
      bodyAr: "القسم العربي يمتلك كثافة منخفضة في SAT والاختبارات المعيارية.",
      bodyEn: "Arabic section shows lower density in SAT/standardized tests.",
      reasonAr: `عربي ${satRow.arabicParticipants} مقابل دولي ${satRow.internationalParticipants} في ${satRow.activityLabelAr}.`,
      reasonEn: `Arabic ${satRow.arabicParticipants} vs intl ${satRow.internationalParticipants} in ${satRow.activityLabelEn}.`,
      targetCohortAr: arSection.labelAr,
      targetCohortEn: arSection.labelEn,
      relatedActivityKey: satRow.activityKey,
      relatedActivityLabelAr: satRow.activityLabelAr,
      relatedActivityLabelEn: satRow.activityLabelEn,
      supportingMetrics: [
        { labelAr: "مشاركات النشاط", labelEn: "Activity participations", value: String(satRow.totalParticipations) },
      ],
      priority: 76,
      trace: makeTrace(
        "rec_part_ar_sat",
        perspective,
        ["table"],
        ["arabicParticipants", "internationalParticipants"],
        ["section", "activity"],
        ["access_gap"],
        "مقارنة مشاركات عربي/دولي في صف النشاط.",
        "Arabic vs intl counts in activity row."
      ),
      drillSource: "activity_row",
      drillPayload: {
        activityKey: satRow.activityKey,
        key: satRow.activityKey,
        labelAr: satRow.activityLabelAr,
        labelEn: satRow.activityLabelEn,
      },
    });
  }

  const progRow = table.find((r) =>
    /programming|برمجة|code|كود/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const midLevel = data.charts.levelDistribution.find((x) =>
    /متوسط|middle|7|8|9/i.test(x.labelEn + x.labelAr)
  );
  if (progRow && midLevel) {
    pushRec(recs, {
      id: "rec_part_mid_programming",
      type: "expansion",
      uiCategory: "expansion",
      severity: "moderate",
      urgency: "medium",
      confidence: 0.68,
      opportunityImpact: 50,
      equityImpact: 48,
      titleAr: "توسيع برامج البرمجة",
      titleEn: "Expand programming programs",
      bodyAr: "يوصى بتوسيع برامج البرمجة للمرحلة المتوسطة.",
      bodyEn: "Expand programming pathways for middle school grades.",
      reasonAr: `${midLevel.labelAr}: ${midLevel.count} مشاركة حالية.`,
      reasonEn: `${midLevel.labelEn}: ${midLevel.count} current participations.`,
      targetCohortAr: midLevel.labelAr,
      targetCohortEn: midLevel.labelEn,
      relatedActivityKey: progRow.activityKey,
      relatedActivityLabelAr: progRow.activityLabelAr,
      relatedActivityLabelEn: progRow.activityLabelEn,
      supportingMetrics: [],
      priority: 72,
      trace: makeTrace(
        "rec_part_mid_programming",
        perspective,
        ["charts", "table"],
        ["levelDistribution"],
        ["level", "activity"],
        ["expansion"],
        "ربط مستوى متوسط بنشاط برمجة.",
        "Middle level linked to programming activity."
      ),
      drillSource: "activity_row",
      drillPayload: {
        activityKey: progRow.activityKey,
        labelAr: progRow.activityLabelAr,
        labelEn: progRow.activityLabelEn,
      },
    });
  }

  return recs;
};

export const buildEquityAndDiversityRecommendations = (
  data: ParticipationAnalyticsPayload,
  table: ParticipationActivityRow[],
  perspective: AnalyticsCountPerspective
): EducationalRecommendation[] => {
  const recs: EducationalRecommendation[] = [];
  const equity = buildEquityIntelligence(data, perspective);
  const female = data.charts.genderParticipation.find((x) => x.key === "female")?.count ?? 0;
  const male = data.charts.genderParticipation.find((x) => x.key === "male")?.count ?? 0;
  const girlsPct = pct(female, male + female);
  const techRows = table.filter((r) =>
    /bebras|بيبراس|robot|روبوت|programming|برمجة|science|علم/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  const techFemale = techRows.reduce((s, r) => s + r.femaleParticipants, 0);
  const techTotal = techRows.reduce((s, r) => s + r.maleParticipants + r.femaleParticipants, 0);

  if (girlsPct < 45 && techTotal > 0 && pct(techFemale, techTotal) < 40) {
    const sev = gapToSeverity(45 - girlsPct);
    pushRec(recs, {
      id: "rec_eq_girls_tech",
      type: "equity",
      uiCategory: "equity",
      severity: sev,
      urgency: severityToUrgency(sev),
      confidence: 0.76,
      opportunityImpact: severityImpact(sev) - 5,
      equityImpact: severityImpact(sev),
      titleAr: "تمثيل البنات — أنشطة تقنية",
      titleEn: "Girls in technical activities",
      bodyAr: "تمثيل البنات منخفض في المسابقات والأنشطة التقنية مقارنة بالبنين.",
      bodyEn: "Girls are under-represented in technical competitions vs boys.",
      reasonAr: `بنات ${pct(techFemale, techTotal)}% في الأنشطة التقنية · تمثيل عام ${girlsPct}%.`,
      reasonEn: `Girls ${pct(techFemale, techTotal)}% in tech activities · overall ${girlsPct}%.`,
      targetCohortAr: "بنات",
      targetCohortEn: "Girls",
      supportingMetrics: [
        { labelAr: "مؤشر العدالة", labelEn: "Equity score", value: String(equity.equityScore) },
      ],
      priority: 84,
      trace: makeTrace(
        "rec_eq_girls_tech",
        perspective,
        ["equity", "table"],
        ["genderParticipation", "femaleParticipants"],
        ["gender", "activity"],
        ["representation_gap"],
        "مقارنة جنس في صفوف الأنشطة التقنية.",
        "Gender split in technical activity rows."
      ),
      drillSource: "gender_bar",
      drillPayload: { key: "female", labelAr: "بنات", labelEn: "Girls" },
    });
  }

  const nonMawP = table.reduce((s, r) => s + r.nonMawhibaParticipants, 0);
  const totalP = table.reduce((s, r) => s + r.totalParticipations, 0);
  const intlP = table.reduce((s, r) => s + r.internationalParticipants, 0);
  if (totalP > 0 && pct(nonMawP, totalP) < 30 && intlP > totalP * 0.2) {
    const sev = gapToSeverity(30 - pct(nonMawP, totalP));
    pushRec(recs, {
      id: "rec_eq_nonmaw_intl",
      type: "access-improvement",
      uiCategory: "equity",
      severity: sev,
      urgency: severityToUrgency(sev),
      confidence: 0.73,
      opportunityImpact: severityImpact(sev),
      equityImpact: severityImpact(sev) - 3,
      titleAr: "فرص أوسع لغير الموهبة",
      titleEn: "Broader access for non-Mawhiba",
      bodyAr: "طلاب غير الموهبة يحتاجون فرصًا أوسع في البرامج الدولية والعلمية.",
      bodyEn: "Non-Mawhiba students need broader access to international and science programs.",
      reasonAr: `غير موهبة ${pct(nonMawP, totalP)}% من المشاركات.`,
      reasonEn: `Non-Mawhiba ${pct(nonMawP, totalP)}% of participations.`,
      targetCohortAr: "غير موهبة",
      targetCohortEn: "Non-Mawhiba",
      supportingMetrics: [],
      priority: 81,
      trace: makeTrace(
        "rec_eq_nonmaw_intl",
        perspective,
        ["table", "equity"],
        ["nonMawhibaParticipants"],
        ["mawhiba", "section"],
        ["access_inequality"],
        "مجموع غير موهبة مقابل برامج دولية.",
        "Non-Mawhiba sum vs international programs."
      ),
      drillSource: "mawhiba_bar",
      drillPayload: { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba" },
    });
  }

  const bebras = table.find((r) => /bebras|بيبراس/i.test(r.activityLabelEn + r.activityLabelAr));
  if (bebras && bebras.femaleParticipants < bebras.maleParticipants * 0.7) {
    const level = bebras.levelLabelAr;
    pushRec(recs, {
      id: "rec_div_girls_bebras",
      type: "diversity",
      uiCategory: "diversity",
      severity: "moderate",
      urgency: "medium",
      confidence: 0.71,
      opportunityImpact: 52,
      equityImpact: 58,
      titleAr: "بيبراس — طالبات",
      titleEn: "Bebras — girls cohort",
      bodyAr: `يوصى بزيادة مشاركة طالبات ${bebras.levelLabelAr} في بيبراس.`,
      bodyEn: `Increase girls' participation in Bebras at ${bebras.levelLabelEn}.`,
      reasonAr: `بنات ${bebras.femaleParticipants} · بنين ${bebras.maleParticipants}.`,
      reasonEn: `Girls ${bebras.femaleParticipants} · boys ${bebras.maleParticipants}.`,
      targetCohortAr: `طالبات · ${level}`,
      targetCohortEn: `Girls · ${bebras.levelLabelEn}`,
      relatedActivityKey: bebras.activityKey,
      relatedActivityLabelAr: bebras.activityLabelAr,
      relatedActivityLabelEn: bebras.activityLabelEn,
      supportingMetrics: [],
      priority: 79,
      trace: makeTrace(
        "rec_div_girls_bebras",
        perspective,
        ["table"],
        ["femaleParticipants", "maleParticipants"],
        ["gender", "level", "activity"],
        ["diversity_warning"],
        "جنس × صف × نشاط بيبراس.",
        "Gender × grade × Bebras activity."
      ),
      drillSource: "activity_row",
      drillPayload: {
        activityKey: bebras.activityKey,
        labelAr: bebras.activityLabelAr,
        labelEn: bebras.activityLabelEn,
      },
    });
  }

  if (male > female * 1.15) {
    const lang = table.find((r) =>
      /english|ielts|لغة|language/i.test(r.activityLabelEn + r.activityLabelAr)
    );
    if (lang) {
      pushRec(recs, {
        id: "rec_div_boys_lang",
        type: "diversity",
        uiCategory: "diversity",
        severity: "info",
        urgency: "low",
        confidence: 0.65,
        opportunityImpact: 40,
        equityImpact: 45,
        titleAr: "مشاركة البنين — لغة",
        titleEn: "Boys language participation",
        bodyAr: "البنين أقل مشاركة من البنات في برامج اللغة الإنجليزية ضمن بعض الأنشطة.",
        bodyEn: "Boys show lower share than girls in some English language programs.",
        reasonAr: `نشاط ${lang.activityLabelAr}: بنين ${lang.maleParticipants} · بنات ${lang.femaleParticipants}.`,
        reasonEn: `${lang.activityLabelEn}: boys ${lang.maleParticipants} · girls ${lang.femaleParticipants}.`,
        targetCohortAr: "بنين",
        targetCohortEn: "Boys",
        relatedActivityKey: lang.activityKey,
        supportingMetrics: [],
        priority: 68,
        trace: makeTrace(
          "rec_div_boys_lang",
          perspective,
          ["table"],
          ["genderParticipation"],
          ["gender"],
          ["participation_imbalance"],
          "مقارنة جنس في نشاط لغة.",
          "Gender comparison in language activity."
        ),
        drillSource: "gender_bar",
        drillPayload: { key: "male", labelAr: "بنين", labelEn: "Boys" },
      });
    }
  }

  return recs;
};

export const buildConcentrationRecommendations = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective
): EducationalRecommendation[] => {
  const recs: EducationalRecommendation[] = [];
  const concentrations = buildActivityConcentrationIntelligence(data.table, 6);

  for (const c of concentrations) {
    if (c.dominantPct < 70) continue;
    const sev = c.dominantPct >= 82 ? "critical" : "high";
    pushRec(recs, {
      id: `rec_conc_${c.activityKey}`,
      type: "concentration-reduction",
      uiCategory: "representation",
      severity: sev,
      urgency: severityToUrgency(sev),
      confidence: 0.75,
      opportunityImpact: severityImpact(sev),
      equityImpact: 50,
      titleAr: "تقليل احتكار النشاط",
      titleEn: "Reduce activity concentration",
      bodyAr: c.recommendationAr,
      bodyEn: c.recommendationEn,
      reasonAr: c.narrativeAr,
      reasonEn: c.narrativeEn,
      targetCohortAr: c.dominantLabelAr,
      targetCohortEn: c.dominantLabelEn,
      relatedActivityKey: c.activityKey,
      relatedActivityLabelAr: c.labelAr,
      relatedActivityLabelEn: c.labelEn,
      supportingMetrics: [
        {
          labelAr: "نسبة التركز",
          labelEn: "Concentration",
          value: `${c.dominantPct}%`,
        },
      ],
      priority: 77,
      trace: makeTrace(
        `rec_conc_${c.activityKey}`,
        perspective,
        ["opportunity", "table"],
        ["concentrationRatio"],
        [c.dominantKind, "activity"],
        ["activity_concentration"],
        "هيمنة فئة داخل صف النشاط.",
        "Cohort dominance within activity row."
      ),
      drillSource: "activity_row",
      drillPayload: {
        activityKey: c.activityKey,
        key: c.activityKey,
        labelAr: c.labelAr,
        labelEn: c.labelEn,
      },
    });
  }

  return recs;
};

export const buildTargetingRecommendations = (
  data: ParticipationAnalyticsPayload,
  table: ParticipationActivityRow[],
  perspective: AnalyticsCountPerspective
): EducationalRecommendation[] => {
  const recs: EducationalRecommendation[] = [];
  const kangaroo = table.find((r) => /kangaroo|كانجارو/i.test(r.activityLabelEn + r.activityLabelAr));
  const intl = data.charts.sectionParticipation.find((x) => x.key === "international");
  const secondaryLevels = data.charts.levelDistribution.filter((x) =>
    /ثانوي|secondary|10|11|12/i.test(x.labelEn + x.labelAr)
  );

  if (kangaroo && intl && secondaryLevels.length > 0) {
    const intlK = kangaroo.internationalParticipants;
    const totalK = kangaroo.totalParticipations;
    if (totalK > 0 && pct(intlK, totalK) < 35) {
      const sev = gapToSeverity(35 - pct(intlK, totalK));
      pushRec(recs, {
        id: "rec_target_intl_kangaroo",
        type: "targeting",
        uiCategory: "representation",
        severity: sev,
        urgency: severityToUrgency(sev),
        confidence: 0.72,
        opportunityImpact: severityImpact(sev),
        equityImpact: 55,
        titleAr: "استهداف كانجارو — ثانوي دولي",
        titleEn: "Target Kangaroo — intl. secondary",
        bodyAr: "طلاب القسم الدولي في المرحلة الثانوية منخفضو التمثيل في كانجارو.",
        bodyEn: "International secondary students are under-represented in Kangaroo.",
        reasonAr: `دولي ${intlK} من ${totalK} مشاركة كانجارو.`,
        reasonEn: `Intl ${intlK} of ${totalK} Kangaroo participations.`,
        targetCohortAr: `${intl.labelAr} · ثانوي`,
        targetCohortEn: `${intl.labelEn} · secondary`,
        relatedActivityKey: kangaroo.activityKey,
        relatedActivityLabelAr: kangaroo.activityLabelAr,
        relatedActivityLabelEn: kangaroo.activityLabelEn,
        supportingMetrics: [],
        priority: 80,
        trace: makeTrace(
          "rec_target_intl_kangaroo",
          perspective,
          ["table", "charts"],
          ["internationalParticipants"],
          ["section", "level", "activity"],
          ["representation_gap"],
          "قسم × مرحلة × كانجارو.",
          "Section × stage × Kangaroo."
        ),
        drillSource: "activity_row",
        drillPayload: {
          activityKey: kangaroo.activityKey,
          labelAr: kangaroo.activityLabelAr,
          labelEn: kangaroo.activityLabelEn,
        },
      });
    }
  }

  const nonMawMid = table.filter(
    (r) =>
      r.nonMawhibaParticipants > r.mawhibaParticipants &&
      /متوسط|middle|7|8|9/i.test(r.levelLabelEn + r.levelLabelAr) &&
      /tech|تقني|bebras|بيبراس|robot/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  if (nonMawMid.length > 0) {
    const r = nonMawMid[0]!;
    pushRec(recs, {
      id: "rec_target_nonmaw_mid_tech",
      type: "targeting",
      uiCategory: "representation",
      severity: "moderate",
      urgency: "medium",
      confidence: 0.69,
      opportunityImpact: 55,
      equityImpact: 52,
      titleAr: "غير موهبة — صف متوسط تقني",
      titleEn: "Non-Mawhiba — middle tech",
      bodyAr: "طلاب غير الموهبة في الصف الثالث المتوسط يحتاجون فرصًا إضافية في الأنشطة التقنية.",
      bodyEn: "Non-Mawhiba middle grades need more technical activity opportunities.",
      reasonAr: `${r.levelLabelAr}: غير موهبة ${r.nonMawhibaParticipants} مشاركة.`,
      reasonEn: `${r.levelLabelEn}: non-Mawhiba ${r.nonMawhibaParticipants} participations.`,
      targetCohortAr: `غير موهبة · ${r.levelLabelAr}`,
      targetCohortEn: `Non-Mawhiba · ${r.levelLabelEn}`,
      relatedActivityKey: r.activityKey,
      relatedActivityLabelAr: r.activityLabelAr,
      relatedActivityLabelEn: r.activityLabelEn,
      supportingMetrics: [],
      priority: 75,
      trace: makeTrace(
        "rec_target_nonmaw_mid_tech",
        perspective,
        ["table"],
        ["nonMawhibaParticipants", "levelLabel"],
        ["mawhiba", "level"],
        ["access_gap"],
        "صف متوسط + غير موهبة + نشاط تقني.",
        "Middle grade + non-Mawhiba + tech activity."
      ),
      drillSource: "activity_row",
      drillPayload: {
        activityKey: r.activityKey,
        labelAr: r.activityLabelAr,
        labelEn: r.activityLabelEn,
      },
    });
  }

  return recs;
};

export const buildRecommendationNarratives = (
  recs: EducationalRecommendation[]
): RecommendationNarrative[] => {
  const narratives: RecommendationNarrative[] = [];
  const top = recs.sort((a, b) => b.priority - a.priority).slice(0, 6);

  for (const r of top) {
    narratives.push({
      id: `nar_${r.id}`,
      bodyAr: r.bodyAr,
      bodyEn: r.bodyEn,
      severity: r.severity,
    });
  }

  const girlsTech = recs.find((r) => r.id === "rec_eq_girls_tech");
  if (girlsTech) {
    narratives.push({
      id: "nar_girls_tech_compare",
      bodyAr: "تمثيل البنات منخفض في الأنشطة التقنية مقارنة بالبنين — يوصى بخطة استهداف فصلية.",
      bodyEn: "Girls are under-represented in technical activities vs boys — recommend a term-level targeting plan.",
      severity: girlsTech.severity,
    });
  }

  return narratives.slice(0, 8);
};

export const buildEducationalRecommendations = (
  data: ParticipationAnalyticsPayload,
  perspective: AnalyticsCountPerspective = "participation"
): RecommendationIntelligenceBundle => {
  const table = data.table;
  const opportunity = buildOpportunityIntelligence(data, perspective);
  const talentSignals = buildTalentDiscoverySignals(table);
  const talentRecs = buildTalentDiscoveryRecommendations(table, talentSignals);

  const all: EducationalRecommendation[] = [
    ...buildParticipationRecommendations(data, table, perspective),
    ...buildEquityAndDiversityRecommendations(data, table, perspective),
    ...buildConcentrationRecommendations(data, perspective),
    ...buildTargetingRecommendations(data, table, perspective),
  ];

  for (const t of talentRecs) {
    all.push({
      id: t.id,
      type: "talent-discovery",
      uiCategory: "talent",
      severity: "moderate",
      urgency: "medium",
      confidence: t.confidence,
      opportunityImpact: 48,
      equityImpact: 42,
      titleAr: "اكتشاف مواهب",
      titleEn: "Talent discovery",
      bodyAr: t.bodyAr,
      bodyEn: t.bodyEn,
      reasonAr: "إشارات تحويل أو تنوع مشاركة.",
      reasonEn: "Conversion or diversity participation signals.",
      targetCohortAr: t.levelLabelAr ?? "طلاب واعدون",
      targetCohortEn: t.levelLabelEn ?? "Promising students",
      relatedActivityKey: t.activityKey,
      relatedActivityLabelAr: undefined,
      relatedActivityLabelEn: undefined,
      supportingMetrics: [],
      priority: t.priority,
      trace: makeTrace(
        t.id,
        perspective,
        ["table", "trend"],
        ["conversion", "distinctParticipants"],
        ["level", "section"],
        ["talent_signal"],
        "إشارة موهبة من صف النشاط.",
        "Talent signal from activity row."
      ),
      drillSource: t.activityKey ? "activity_row" : "section_bar",
      drillPayload: {
        activityKey: t.activityKey,
        key: t.activityKey,
        labelAr: t.levelLabelAr,
        labelEn: t.levelLabelEn,
      },
    });
  }

  for (const opp of opportunity.recommendations.slice(0, 3)) {
    all.push({
      id: `rec_from_opp_${opp.id}`,
      type: "expansion",
      uiCategory: "expansion",
      severity: "moderate",
      urgency: "medium",
      confidence: 0.7,
      opportunityImpact: 55,
      equityImpact: 50,
      titleAr: "توسيع فرص",
      titleEn: "Expand opportunities",
      bodyAr: opp.bodyAr,
      bodyEn: opp.bodyEn,
      reasonAr: "مشتق من تحليل الفرص.",
      reasonEn: "Derived from opportunity intelligence.",
      targetCohortAr: "النطاق المفلتر",
      targetCohortEn: "Filtered scope",
      relatedActivityKey: opp.relatedActivityKey,
      supportingMetrics: [],
      priority: opp.priority,
      trace: makeTrace(
        opp.id,
        perspective,
        ["opportunity"],
        ["opportunityScore"],
        [],
        ["opportunity_gap"],
        "توصية فرصة معتمدة.",
        "Opportunity-derived recommendation."
      ),
      drillSource: opp.relatedActivityKey ? "activity_row" : "section_bar",
      drillPayload: { activityKey: opp.relatedActivityKey, key: opp.relatedActivityKey },
    });
  }

  const sorted = all.sort((a, b) => b.priority - a.priority);
  const byCategory: RecommendationIntelligenceBundle["byCategory"] = {
    participation: [],
    equity: [],
    diversity: [],
    expansion: [],
    talent: [],
    representation: [],
  };
  for (const r of sorted) {
    byCategory[r.uiCategory].push(r);
  }

  const trendBoost =
    data.charts.yearTrend.length >= 2
      ? (() => {
          const ys = [...data.charts.yearTrend].sort((a, b) => a.year - b.year);
          const last = ys[ys.length - 1]!;
          const prev = ys[ys.length - 2]!;
          return prev.totalRows > 0 && last.totalRows < prev.totalRows * 0.85;
        })()
      : false;

  if (trendBoost && sorted[0]) {
    sorted[0].urgency = "high";
    sorted[0].severity =
      sorted[0].severity === "info" ? "moderate" : sorted[0].severity;
  }

  return {
    recommendationScore: computeRecommendationScore(sorted),
    recommendations: sorted,
    narratives: buildRecommendationNarratives(sorted),
    heatmap: buildOpportunityHeatmap(data, perspective),
    byCategory,
    talentCount: talentRecs.length,
  };
};

/** Recommendation comparison deltas for AnalyticsComparisonWorkspace */
export type RecommendationComparisonDelta = {
  key: "participation_improvement" | "representation" | "equity_improvement" | "opportunity_expansion";
  labelAr: string;
  labelEn: string;
  valueA: number;
  valueB: number;
  delta: number;
};

export const buildRecommendationComparisonDeltas = (
  data: ParticipationAnalyticsPayload,
  sideAKey: string,
  sideBKey: string,
  dimension: "section" | "gender" | "mawhiba"
): RecommendationComparisonDelta[] => {
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
  const total = data.kpis.totalParticipations || 1;
  const bundleA = buildEducationalRecommendations(data, "participation");
  const recScore = bundleA.recommendationScore;

  return [
    {
      key: "participation_improvement",
      labelAr: "فرص تحسين المشاركة",
      labelEn: "Participation improvement potential",
      valueA: pct(a, total),
      valueB: pct(b, total),
      delta: Math.round((pct(a, total) - pct(b, total)) * 10) / 10,
    },
    {
      key: "representation",
      labelAr: "فرق التمثيل",
      labelEn: "Representation gap",
      valueA: pct(a, a + b || 1),
      valueB: pct(b, a + b || 1),
      delta: Math.round((pct(a, a + b || 1) - pct(b, a + b || 1)) * 10) / 10,
    },
    {
      key: "equity_improvement",
      labelAr: "مؤشر التوصيات",
      labelEn: "Recommendation index",
      valueA: recScore,
      valueB: 100 - recScore,
      delta: recScore - (100 - recScore),
    },
    {
      key: "opportunity_expansion",
      labelAr: "احتياج التوسع",
      labelEn: "Expansion need",
      valueA: Math.max(0, 50 - pct(a, total)),
      valueB: Math.max(0, 50 - pct(b, total)),
      delta: Math.round((Math.max(0, 50 - pct(b, total)) - Math.max(0, 50 - pct(a, total))) * 10) / 10,
    },
  ];
};

/**
 * Analytics Metric Registry — single source of truth for measures across the platform.
 */

import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import {
  formatCompactNumber,
  formatLocalizedNumber,
  formatPercentage,
  formatScore,
  normalizeDecimal,
  ratioToPercentage,
} from "@/lib/analytics/analytics-number-formatting";

export type MetricCategory =
  | "participation"
  | "achievement"
  | "equity"
  | "opportunity"
  | "talent"
  | "funnel"
  | "governance"
  | "historical";

export type AggregationStrategy =
  | "sum"
  | "average"
  | "weighted_average"
  | "max"
  | "min"
  | "growth"
  | "conversion"
  | "ratio"
  | "density";

export type TrendSemantic =
  | "accelerating"
  | "declining"
  | "stable"
  | "volatile"
  | "historical_peak"
  | "recovery"
  | "emerging_growth";

export type CubeDimensionKey =
  | "year"
  | "academicYear"
  | "gender"
  | "section"
  | "campus"
  | "level"
  | "grade"
  | "activity"
  | "achievementType"
  | "participationType"
  | "talentStatus"
  | "medalType";

export type MetricId =
  | "participation_count"
  | "unique_students"
  | "medal_conversion"
  | "qualification_rate"
  | "acceptance_rate"
  | "opportunity_score"
  | "equity_gap"
  | "representation_balance"
  | "talent_growth"
  | "historical_growth"
  | "participation_density"
  | "activity_concentration"
  | "program_conversion"
  | "funnel_success_rate"
  | "institutional_growth"
  | "participation_sustainability"
  | "medal_maturity"
  | "talent_pipeline_health"
  | "program_effectiveness"
  | "qualification_efficiency"
  | "gold_medals"
  | "silver_medals"
  | "bronze_medals"
  | "award_winners"
  | "qualified_students"
  | "accepted_students"
  | "finalists"
  | "ranking_score"
  | "competition_strength"
  | "award_density";

export type MetricFormatKind = "count" | "percentage" | "score" | "ratio" | "density";

export type MetricDefinition = {
  id: MetricId;
  label: { ar: string; en: string };
  shortLabel: { ar: string; en: string };
  description: { ar: string; en: string };
  category: MetricCategory;
  dimensions: CubeDimensionKey[];
  perspectives: AnalyticsCountPerspective[];
  formula: string;
  formatting: MetricFormatKind;
  decimals: number;
  aggregation: AggregationStrategy;
  trendSemantics: TrendSemantic[];
  exportLabel: { ar: string; en: string };
  tooltip: { ar: string; en: string };
  narrativeWording: { up: { ar: string; en: string }; down: { ar: string; en: string } };
  severityThresholds: { warn: number; critical: number };
  benchmarkTarget?: number;
  comparisonBehavior: "higher_is_better" | "lower_is_better" | "target_band";
};

const def = (
  partial: Omit<MetricDefinition, "formula"> & { formula?: string }
): MetricDefinition => ({
  ...partial,
  formula: partial.formula ?? partial.id,
});

export const METRIC_REGISTRY: Record<MetricId, MetricDefinition> = {
  participation_count: def({
    id: "participation_count",
    label: { ar: "عدد المشاركات", en: "Participation count" },
    shortLabel: { ar: "مشاركات", en: "Participations" },
    description: { ar: "مجموع سجلات المشاركة ضمن النطاق", en: "Sum of participation records in scope" },
    category: "participation",
    dimensions: ["year", "gender", "section", "level", "activity", "grade"],
    perspectives: ["participation", "record"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["accelerating", "declining", "stable"],
    exportLabel: { ar: "المشاركات", en: "Participations" },
    tooltip: { ar: "كل إدخال مشاركة واحد", en: "Each row is one participation record" },
    narrativeWording: {
      up: { ar: "ارتفعت المشاركات", en: "Participation increased" },
      down: { ar: "انخفضت المشاركات", en: "Participation decreased" },
    },
    severityThresholds: { warn: -15, critical: -30 },
    comparisonBehavior: "higher_is_better",
  }),
  unique_students: def({
    id: "unique_students",
    label: { ar: "الطلاب المشاركون", en: "Participating students" },
    shortLabel: { ar: "طلاب", en: "Students" },
    description: { ar: "عدد الطلاب المختلفين", en: "Distinct participating students" },
    category: "participation",
    dimensions: ["year", "gender", "section", "level", "grade"],
    perspectives: ["student"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["emerging_growth", "stable"],
    exportLabel: { ar: "الطلاب", en: "Students" },
    tooltip: { ar: "بدون تكرار الطالب", en: "Deduplicated by student" },
    narrativeWording: {
      up: { ar: "ازداد عدد الطلاب المشاركين", en: "More students participated" },
      down: { ar: "قل عدد الطلاب المشاركين", en: "Fewer students participated" },
    },
    severityThresholds: { warn: -10, critical: -25 },
    comparisonBehavior: "higher_is_better",
  }),
  medal_conversion: def({
    id: "medal_conversion",
    formula: "(medals / participations) × 100",
    label: { ar: "معدل تحويل الميداليات", en: "Medal conversion rate" },
    shortLabel: { ar: "تحويل %", en: "Conversion %" },
    description: { ar: "نسبة الميداليات إلى المشاركات", en: "Medals per participation" },
    category: "achievement",
    dimensions: ["year", "activity", "gender", "section"],
    perspectives: ["participation", "result"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "conversion",
    trendSemantics: ["accelerating", "historical_peak", "recovery"],
    exportLabel: { ar: "تحويل الميداليات", en: "Medal conversion" },
    tooltip: { ar: "ميداليات ÷ مشاركات", en: "Medals ÷ participations" },
    narrativeWording: {
      up: { ar: "تحسّن معدل التحويل", en: "Conversion improved" },
      down: { ar: "تراجع معدل التحويل", en: "Conversion declined" },
    },
    severityThresholds: { warn: 12, critical: 8 },
    benchmarkTarget: 18,
    comparisonBehavior: "higher_is_better",
  }),
  qualification_rate: def({
    id: "qualification_rate",
    formula: "(nominations / participations) × 100",
    label: { ar: "معدل الترشيح", en: "Qualification rate" },
    shortLabel: { ar: "ترشيح %", en: "Nomination %" },
    description: { ar: "نسبة الترشيحات من المشاركات", en: "Nominations over participations" },
    category: "funnel",
    dimensions: ["year", "activity", "section"],
    perspectives: ["participation", "achievement"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "ratio",
    trendSemantics: ["stable", "volatile"],
    exportLabel: { ar: "الترشيح", en: "Nomination" },
    tooltip: { ar: "مرحلة ما قبل القبول", en: "Pre-acceptance stage" },
    narrativeWording: {
      up: { ar: "ارتفع الترشيح", en: "Nomination rate rose" },
      down: { ar: "انخفض الترشيح", en: "Nomination rate fell" },
    },
    severityThresholds: { warn: 20, critical: 12 },
    comparisonBehavior: "higher_is_better",
  }),
  acceptance_rate: def({
    id: "acceptance_rate",
    formula: "(acceptances / nominations) × 100",
    label: { ar: "معدل القبول", en: "Acceptance rate" },
    shortLabel: { ar: "قبول %", en: "Acceptance %" },
    description: { ar: "نسبة القبول من الترشيحات", en: "Acceptances over nominations" },
    category: "funnel",
    dimensions: ["year", "activity", "section"],
    perspectives: ["achievement"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "conversion",
    trendSemantics: ["recovery", "declining"],
    exportLabel: { ar: "القبول", en: "Acceptance" },
    tooltip: { ar: "إنجازات معتمدة أو قبول", en: "Approved achievements / acceptance" },
    narrativeWording: {
      up: { ar: "تحسّن القبول", en: "Acceptance improved" },
      down: { ar: "ضعف القبول", en: "Acceptance weakened" },
    },
    severityThresholds: { warn: 35, critical: 20 },
    comparisonBehavior: "higher_is_better",
  }),
  opportunity_score: def({
    id: "opportunity_score",
    label: { ar: "مؤشر الفرص", en: "Opportunity score" },
    shortLabel: { ar: "فرص", en: "Opportunity" },
    description: { ar: "مؤشر مركّب للوصول والتنوع", en: "Composite access and diversity score" },
    category: "opportunity",
    dimensions: ["year", "section", "level"],
    perspectives: ["participation", "student"],
    formatting: "score",
    decimals: 0,
    aggregation: "weighted_average",
    trendSemantics: ["emerging_growth", "stable"],
    exportLabel: { ar: "مؤشر الفرص", en: "Opportunity score" },
    tooltip: { ar: "0–100", en: "0–100 scale" },
    narrativeWording: {
      up: { ar: "توسّعت الفرص", en: "Opportunities expanded" },
      down: { ar: "ضاقت الفرص", en: "Opportunities narrowed" },
    },
    severityThresholds: { warn: 55, critical: 40 },
    benchmarkTarget: 70,
    comparisonBehavior: "higher_is_better",
  }),
  equity_gap: def({
    id: "equity_gap",
    label: { ar: "فجوة العدالة", en: "Equity gap" },
    shortLabel: { ar: "فجوة", en: "Gap" },
    description: { ar: "أقصى انحراف تمثيل بين الفئات", en: "Max representation deviation" },
    category: "equity",
    dimensions: ["gender", "section", "talentStatus"],
    perspectives: ["participation", "student"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "max",
    trendSemantics: ["volatile", "declining"],
    exportLabel: { ar: "فجوة العدالة", en: "Equity gap" },
    tooltip: { ar: "كلما قلّ كان أفضل", en: "Lower is better" },
    narrativeWording: {
      up: { ar: "اتسعت فجوة العدالة", en: "Equity gap widened" },
      down: { ar: "انكمشت فجوة العدالة", en: "Equity gap narrowed" },
    },
    severityThresholds: { warn: 15, critical: 25 },
    comparisonBehavior: "lower_is_better",
  }),
  representation_balance: def({
    id: "representation_balance",
    formula: "100 - equity_gap",
    label: { ar: "توازن التمثيل", en: "Representation balance" },
    shortLabel: { ar: "تمثيل", en: "Balance" },
    description: { ar: "مدى توازن التمثيل بين الفئات", en: "Balance of cohort representation" },
    category: "equity",
    dimensions: ["gender", "section"],
    perspectives: ["participation"],
    formatting: "score",
    decimals: 0,
    aggregation: "average",
    trendSemantics: ["stable", "recovery"],
    exportLabel: { ar: "التمثيل", en: "Representation" },
    tooltip: { ar: "مؤشر 0–100", en: "0–100 index" },
    narrativeWording: {
      up: { ar: "تحسّن التوازن", en: "Balance improved" },
      down: { ar: "تراجع التوازن", en: "Balance declined" },
    },
    severityThresholds: { warn: 60, critical: 45 },
    benchmarkTarget: 75,
    comparisonBehavior: "higher_is_better",
  }),
  talent_growth: def({
    id: "talent_growth",
    label: { ar: "نمو المواهب", en: "Talent growth" },
    shortLabel: { ar: "نمو موهبة", en: "Talent growth" },
    description: { ar: "نمو مشاركات الموهبة", en: "Growth in talent cohort participation" },
    category: "talent",
    dimensions: ["year", "grade", "section"],
    perspectives: ["student", "participation"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "growth",
    trendSemantics: ["emerging_growth", "accelerating"],
    exportLabel: { ar: "نمو المواهب", en: "Talent growth" },
    tooltip: { ar: "سنوي أو تراكمي", en: "Year-over-year or cumulative" },
    narrativeWording: {
      up: { ar: "تسارع نمو المواهب", en: "Talent growth accelerated" },
      down: { ar: "تباطأ نمو المواهب", en: "Talent growth slowed" },
    },
    severityThresholds: { warn: -8, critical: -20 },
    comparisonBehavior: "higher_is_better",
  }),
  historical_growth: def({
    id: "historical_growth",
    label: { ar: "النمو التاريخي", en: "Historical growth" },
    shortLabel: { ar: "نمو %", en: "Growth %" },
    description: { ar: "نمو تراكمي عبر السنوات", en: "Cumulative growth across years" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["participation", "achievement"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "growth",
    trendSemantics: ["historical_peak", "accelerating", "declining"],
    exportLabel: { ar: "النمو التاريخي", en: "Historical growth" },
    tooltip: { ar: "CAGR أو فترة محددة", en: "CAGR or selected period" },
    narrativeWording: {
      up: { ar: "نمو تاريخي إيجابي", en: "Positive historical growth" },
      down: { ar: "تراجع تاريخي", en: "Historical decline" },
    },
    severityThresholds: { warn: -5, critical: -15 },
    comparisonBehavior: "higher_is_better",
  }),
  participation_density: def({
    id: "participation_density",
    formula: "participations / students",
    label: { ar: "كثافة المشاركة", en: "Participation density" },
    shortLabel: { ar: "كثافة", en: "Density" },
    description: { ar: "متوسط المشاركات لكل طالب", en: "Participations per student" },
    category: "participation",
    dimensions: ["activity", "level", "section"],
    perspectives: ["participation", "student"],
    formatting: "density",
    decimals: 2,
    aggregation: "density",
    trendSemantics: ["stable", "volatile"],
    exportLabel: { ar: "الكثافة", en: "Density" },
    tooltip: { ar: "مشاركات لكل طالب", en: "Per-student participations" },
    narrativeWording: {
      up: { ar: "ارتفعت الكثافة", en: "Density increased" },
      down: { ar: "انخفضت الكثافة", en: "Density decreased" },
    },
    severityThresholds: { warn: 1.2, critical: 0.8 },
    comparisonBehavior: "target_band",
  }),
  activity_concentration: def({
    id: "activity_concentration",
    label: { ar: "تركز النشاط", en: "Activity concentration" },
    shortLabel: { ar: "تركز", en: "Concentration" },
    description: { ar: "نسبة المشاركات في أعلى نشاط", en: "Share in top activity" },
    category: "opportunity",
    dimensions: ["activity", "year"],
    perspectives: ["participation"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "max",
    trendSemantics: ["volatile"],
    exportLabel: { ar: "التركز", en: "Concentration" },
    tooltip: { ar: "كلما قلّ كان أفضل للتنوع", en: "Lower implies more diversity" },
    narrativeWording: {
      up: { ar: "ازداد التركز في نشاط واحد", en: "Concentration in one activity rose" },
      down: { ar: "تنوّعت المشاركات", en: "Participation diversified" },
    },
    severityThresholds: { warn: 40, critical: 55 },
    comparisonBehavior: "lower_is_better",
  }),
  program_conversion: def({
    id: "program_conversion",
    formula: "(next_stage / current_stage) × 100",
    label: { ar: "تحويل البرنامج", en: "Program conversion" },
    shortLabel: { ar: "تحويل", en: "Conversion" },
    description: { ar: "كفاءة الانتقال بين مراحل البرنامج", en: "Stage-to-stage program efficiency" },
    category: "funnel",
    dimensions: ["activity", "year"],
    perspectives: ["achievement", "participation"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "conversion",
    trendSemantics: ["recovery", "declining"],
    exportLabel: { ar: "تحويل البرنامج", en: "Program conversion" },
    tooltip: { ar: "مسار تدريب أو مسابقة", en: "Training or competition pipeline" },
    narrativeWording: {
      up: { ar: "تحسّن تحويل البرنامج", en: "Program conversion improved" },
      down: { ar: "ضعف تحويل البرنامج", en: "Program conversion weakened" },
    },
    severityThresholds: { warn: 30, critical: 18 },
    comparisonBehavior: "higher_is_better",
  }),
  funnel_success_rate: def({
    id: "funnel_success_rate",
    formula: "(final_stage / entry) × 100",
    label: { ar: "نجاح المسار", en: "Funnel success rate" },
    shortLabel: { ar: "نجاح %", en: "Success %" },
    description: { ar: "نسبة الوصول للمرحلة النهائية", en: "Reach final funnel stage" },
    category: "funnel",
    dimensions: ["activity", "year"],
    perspectives: ["achievement"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "conversion",
    trendSemantics: ["stable", "accelerating"],
    exportLabel: { ar: "نجاح المسار", en: "Funnel success" },
    tooltip: { ar: "من المشاركة إلى الإنجاز", en: "Participation to outcome" },
    narrativeWording: {
      up: { ar: "تحسّن نجاح المسار", en: "Funnel success improved" },
      down: { ar: "تسرّب في المسار", en: "Funnel leakage increased" },
    },
    severityThresholds: { warn: 25, critical: 12 },
    comparisonBehavior: "higher_is_better",
  }),
  institutional_growth: def({
    id: "institutional_growth",
    label: { ar: "النمو المؤسسي", en: "Institutional growth" },
    shortLabel: { ar: "نمو مؤسسي", en: "Institutional" },
    description: { ar: "نمو شامل للمشاركات والطلاب", en: "Holistic participation and student growth" },
    category: "governance",
    dimensions: ["year"],
    perspectives: ["participation", "student"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "growth",
    trendSemantics: ["accelerating", "emerging_growth"],
    exportLabel: { ar: "النمو المؤسسي", en: "Institutional growth" },
    tooltip: { ar: "مؤشر حوكمة", en: "Governance indicator" },
    narrativeWording: {
      up: { ar: "نمو مؤسسي قوي", en: "Strong institutional growth" },
      down: { ar: "تباطؤ مؤسسي", en: "Institutional slowdown" },
    },
    severityThresholds: { warn: -3, critical: -12 },
    comparisonBehavior: "higher_is_better",
  }),
  participation_sustainability: def({
    id: "participation_sustainability",
    label: { ar: "استدامة المشاركة", en: "Participation sustainability" },
    shortLabel: { ar: "استدامة", en: "Sustainability" },
    description: { ar: "ثبات المشاركة عبر السنوات", en: "Stability of participation over years" },
    category: "governance",
    dimensions: ["year"],
    perspectives: ["participation"],
    formatting: "score",
    decimals: 0,
    aggregation: "average",
    trendSemantics: ["stable", "volatile"],
    exportLabel: { ar: "الاستدامة", en: "Sustainability" },
    tooltip: { ar: "عكس التقلب", en: "Inverse of volatility" },
    narrativeWording: {
      up: { ar: "استدامة أعلى", en: "Higher sustainability" },
      down: { ar: "تقلب مرتفع", en: "Higher volatility" },
    },
    severityThresholds: { warn: 55, critical: 40 },
    comparisonBehavior: "higher_is_better",
  }),
  medal_maturity: def({
    id: "medal_maturity",
    label: { ar: "نضج الميداليات", en: "Medal maturity" },
    shortLabel: { ar: "نضج", en: "Maturity" },
    description: { ar: "جودة التحويل والتوزيع", en: "Conversion quality and spread" },
    category: "governance",
    dimensions: ["year", "activity"],
    perspectives: ["result", "participation"],
    formatting: "score",
    decimals: 0,
    aggregation: "weighted_average",
    trendSemantics: ["historical_peak", "recovery"],
    exportLabel: { ar: "نضج الميداليات", en: "Medal maturity" },
    tooltip: { ar: "0–100", en: "0–100" },
    narrativeWording: {
      up: { ar: "نضج ميدالي أعلى", en: "Higher medal maturity" },
      down: { ar: "تراجع النضج", en: "Maturity declined" },
    },
    severityThresholds: { warn: 50, critical: 35 },
    comparisonBehavior: "higher_is_better",
  }),
  talent_pipeline_health: def({
    id: "talent_pipeline_health",
    label: { ar: "صحة مسار المواهب", en: "Talent pipeline health" },
    shortLabel: { ar: "مسار موهبة", en: "Pipeline" },
    description: { ar: "كفاءة مسار اكتشاف المواهب", en: "Talent discovery pipeline efficiency" },
    category: "governance",
    dimensions: ["year", "talentStatus"],
    perspectives: ["student", "achievement"],
    formatting: "score",
    decimals: 0,
    aggregation: "conversion",
    trendSemantics: ["emerging_growth", "recovery"],
    exportLabel: { ar: "صحة المسار", en: "Pipeline health" },
    tooltip: { ar: "من واعد إلى استثنائي", en: "Promising to exceptional" },
    narrativeWording: {
      up: { ar: "مسار مواهب أقوى", en: "Stronger talent pipeline" },
      down: { ar: "تسرّب في مسار المواهب", en: "Talent pipeline leakage" },
    },
    severityThresholds: { warn: 45, critical: 30 },
    comparisonBehavior: "higher_is_better",
  }),
  program_effectiveness: def({
    id: "program_effectiveness",
    label: { ar: "فعالية البرنامج", en: "Program effectiveness" },
    shortLabel: { ar: "فعالية", en: "Effectiveness" },
    description: { ar: "قبول وتحويل البرامج", en: "Program acceptance and conversion" },
    category: "governance",
    dimensions: ["activity", "year"],
    perspectives: ["achievement"],
    formatting: "score",
    decimals: 0,
    aggregation: "weighted_average",
    trendSemantics: ["stable", "accelerating"],
    exportLabel: { ar: "فعالية البرنامج", en: "Program effectiveness" },
    tooltip: { ar: "مؤشر مركّب", en: "Composite index" },
    narrativeWording: {
      up: { ar: "فعالية برامج أعلى", en: "Higher program effectiveness" },
      down: { ar: "ضعف فعالية البرامج", en: "Program effectiveness weakened" },
    },
    severityThresholds: { warn: 50, critical: 35 },
    comparisonBehavior: "higher_is_better",
  }),
  qualification_efficiency: def({
    id: "qualification_efficiency",
    label: { ar: "كفاءة التأهيل", en: "Qualification efficiency" },
    shortLabel: { ar: "تأهيل", en: "Qualification" },
    description: { ar: "من مشاركة إلى ترشيح", en: "Participation to nomination efficiency" },
    category: "governance",
    dimensions: ["year", "activity"],
    perspectives: ["participation", "achievement"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "ratio",
    trendSemantics: ["stable", "declining"],
    exportLabel: { ar: "كفاءة التأهيل", en: "Qualification efficiency" },
    tooltip: { ar: "مرحلة التأهيل", en: "Qualification stage" },
    narrativeWording: {
      up: { ar: "تحسّن كفاءة التأهيل", en: "Qualification efficiency improved" },
      down: { ar: "فجوة تأهيل أوسع", en: "Qualification gap widened" },
    },
    severityThresholds: { warn: 25, critical: 15 },
    comparisonBehavior: "higher_is_better",
  }),
  gold_medals: def({
    id: "gold_medals",
    label: { ar: "ميداليات ذهبية", en: "Gold medals" },
    shortLabel: { ar: "ذهب", en: "Gold" },
    description: { ar: "إجمالي الميداليات الذهبية", en: "Total gold medals" },
    category: "historical",
    dimensions: ["year", "activity", "section"],
    perspectives: ["result"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["historical_peak", "declining"],
    exportLabel: { ar: "ذهبية", en: "Gold" },
    tooltip: { ar: "نتائج تتويج", en: "Award outcomes" },
    narrativeWording: {
      up: { ar: "ارتفع الذهب", en: "Gold medals increased" },
      down: { ar: "تراجع الذهب", en: "Gold medals declined" },
    },
    severityThresholds: { warn: 2, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  silver_medals: def({
    id: "silver_medals",
    label: { ar: "ميداليات فضية", en: "Silver medals" },
    shortLabel: { ar: "فضة", en: "Silver" },
    description: { ar: "إجمالي الميداليات الفضية", en: "Total silver medals" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["stable", "volatile"],
    exportLabel: { ar: "فضية", en: "Silver" },
    tooltip: { ar: "نتائج فضية", en: "Silver outcomes" },
    narrativeWording: {
      up: { ar: "تحسّن الفضة", en: "Silver improved" },
      down: { ar: "تراجع الفضة", en: "Silver declined" },
    },
    severityThresholds: { warn: 2, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  bronze_medals: def({
    id: "bronze_medals",
    label: { ar: "ميداليات برونزية", en: "Bronze medals" },
    shortLabel: { ar: "برونز", en: "Bronze" },
    description: { ar: "إجمالي الميداليات البرونزية", en: "Total bronze medals" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["stable"],
    exportLabel: { ar: "برونزية", en: "Bronze" },
    tooltip: { ar: "نتائج برونزية", en: "Bronze outcomes" },
    narrativeWording: {
      up: { ar: "تحسّن البرونز", en: "Bronze improved" },
      down: { ar: "تراجع البرونز", en: "Bronze declined" },
    },
    severityThresholds: { warn: 2, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  award_winners: def({
    id: "award_winners",
    label: { ar: "الحاصلون على جوائز", en: "Award winners" },
    shortLabel: { ar: "جوائز", en: "Awards" },
    description: { ar: "مجموع الفائزين بالميداليات", en: "Total medal awardees" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["historical_peak"],
    exportLabel: { ar: "جوائز", en: "Awards" },
    tooltip: { ar: "ميداليات مجمّعة", en: "Combined medals" },
    narrativeWording: {
      up: { ar: "ارتفع التتويج", en: "Awards increased" },
      down: { ar: "تراجع التتويج", en: "Awards declined" },
    },
    severityThresholds: { warn: 3, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  qualified_students: def({
    id: "qualified_students",
    label: { ar: "المتأهلون", en: "Qualified students" },
    shortLabel: { ar: "تأهل", en: "Qualified" },
    description: { ar: "ترشيحات وتأهيلات", en: "Nominations and qualifications" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["achievement"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["accelerating"],
    exportLabel: { ar: "متأهلون", en: "Qualified" },
    tooltip: { ar: "مرحلة التأهيل", en: "Qualification stage" },
    narrativeWording: {
      up: { ar: "توسّع التأهيل", en: "Qualification expanded" },
      down: { ar: "ضعف التأهيل", en: "Qualification weakened" },
    },
    severityThresholds: { warn: 2, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  accepted_students: def({
    id: "accepted_students",
    label: { ar: "المقبولون", en: "Accepted students" },
    shortLabel: { ar: "قبول", en: "Accepted" },
    description: { ar: "قبولات وإنجازات معتمدة", en: "Acceptances and approvals" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["achievement"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["recovery"],
    exportLabel: { ar: "مقبولون", en: "Accepted" },
    tooltip: { ar: "نتائج قبول", en: "Acceptance outcomes" },
    narrativeWording: {
      up: { ar: "تحسّن القبول", en: "Acceptance improved" },
      down: { ar: "تراجع القبول", en: "Acceptance declined" },
    },
    severityThresholds: { warn: 1, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  finalists: def({
    id: "finalists",
    label: { ar: "نهائيون", en: "Finalists" },
    shortLabel: { ar: "نهائي", en: "Finalist" },
    description: { ar: "وصول للمرحلة النهائية", en: "Final-stage placements" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result"],
    formatting: "count",
    decimals: 0,
    aggregation: "sum",
    trendSemantics: ["stable"],
    exportLabel: { ar: "نهائيون", en: "Finalists" },
    tooltip: { ar: "مراكز نهائية", en: "Final rankings" },
    narrativeWording: {
      up: { ar: "ازداد النهائيون", en: "Finalists increased" },
      down: { ar: "قلّ النهائيون", en: "Finalists decreased" },
    },
    severityThresholds: { warn: 1, critical: 0 },
    comparisonBehavior: "higher_is_better",
  }),
  ranking_score: def({
    id: "ranking_score",
    label: { ar: "مؤشر المراكز", en: "Ranking score" },
    shortLabel: { ar: "مراكز", en: "Rank" },
    description: { ar: "قوة المراكز والتصنيف", en: "Ranking strength index" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result"],
    formatting: "score",
    decimals: 0,
    aggregation: "weighted_average",
    trendSemantics: ["volatile", "historical_peak"],
    exportLabel: { ar: "مراكز", en: "Rankings" },
    tooltip: { ar: "0–100", en: "0–100" },
    narrativeWording: {
      up: { ar: "تعزّزت المراكز", en: "Rankings strengthened" },
      down: { ar: "ضعفت المراكز", en: "Rankings weakened" },
    },
    severityThresholds: { warn: 15, critical: 5 },
    comparisonBehavior: "higher_is_better",
  }),
  competition_strength: def({
    id: "competition_strength",
    label: { ar: "قوة المسابقة", en: "Competition strength" },
    shortLabel: { ar: "قوة", en: "Strength" },
    description: { ar: "مؤشر مركّب للنتائج", en: "Composite results strength" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result", "achievement"],
    formatting: "score",
    decimals: 0,
    aggregation: "weighted_average",
    trendSemantics: ["historical_peak", "declining"],
    exportLabel: { ar: "قوة", en: "Strength" },
    tooltip: { ar: "نتائج + تأهيل + مراكز", en: "Awards + qualification + ranks" },
    narrativeWording: {
      up: { ar: "تعزّز الأداء", en: "Performance strengthened" },
      down: { ar: "تراجع الأداء", en: "Performance declined" },
    },
    severityThresholds: { warn: 25, critical: 10 },
    comparisonBehavior: "higher_is_better",
  }),
  award_density: def({
    id: "award_density",
    label: { ar: "كثافة التتويج", en: "Award density" },
    shortLabel: { ar: "كثافة", en: "Density" },
    description: { ar: "جوائز لكل مشاركة", en: "Awards per participation" },
    category: "historical",
    dimensions: ["year", "activity"],
    perspectives: ["result"],
    formatting: "percentage",
    decimals: 1,
    aggregation: "density",
    trendSemantics: ["accelerating", "declining"],
    exportLabel: { ar: "كثافة تتويج", en: "Award density" },
    tooltip: { ar: "% من المشاركات", en: "% of participations" },
    narrativeWording: {
      up: { ar: "ارتفعت كثافة التتويج", en: "Award density rose" },
      down: { ar: "انخفضت كثافة التتويج", en: "Award density fell" },
    },
    severityThresholds: { warn: 8, critical: 3 },
    comparisonBehavior: "higher_is_better",
  }),
};

export const getMetricDefinition = (id: MetricId): MetricDefinition => METRIC_REGISTRY[id];

export const listMetricsByCategory = (category: MetricCategory): MetricDefinition[] =>
  Object.values(METRIC_REGISTRY).filter((m) => m.category === category);

/** Format a raw metric value using registry rules */
export const formatMetricValue = (
  id: MetricId,
  value: number,
  loc: AnalyticsLocale = "ar"
): string => {
  const m = getMetricDefinition(id);
  const n = normalizeDecimal(value, m.decimals);
  switch (m.formatting) {
    case "percentage":
      return formatPercentage(n, loc, { decimals: m.decimals });
    case "score":
      return formatScore(n, loc);
    case "density":
      return `${formatLocalizedNumber(n, loc, m.decimals)} ${loc === "ar" ? "لكل طالب" : "per student"}`;
    case "ratio":
      return formatLocalizedNumber(n, loc, m.decimals);
    case "count":
    default:
      return n >= 1000 ? formatCompactNumber(n, loc) : formatLocalizedNumber(n, loc, 0);
  }
};

export const evaluateMetricSeverity = (
  id: MetricId,
  value: number
): "ok" | "warn" | "critical" => {
  const m = getMetricDefinition(id);
  if (m.comparisonBehavior === "lower_is_better") {
    if (value >= m.severityThresholds.critical) return "critical";
    if (value >= m.severityThresholds.warn) return "warn";
    return "ok";
  }
  if (value <= m.severityThresholds.critical) return "critical";
  if (value <= m.severityThresholds.warn) return "warn";
  return "ok";
};

export const computeMetricFromPayload = (
  id: MetricId,
  totals: {
    participations: number;
    students: number;
    medals: number;
    nominations: number;
    acceptances: number;
    topActivityShare?: number;
  }
): number => {
  const { participations, students, medals, nominations, acceptances, topActivityShare } = totals;
  switch (id) {
    case "participation_count":
      return participations;
    case "unique_students":
      return students;
    case "medal_conversion":
      return ratioToPercentage(medals, participations);
    case "qualification_rate":
      return ratioToPercentage(nominations, participations);
    case "acceptance_rate":
      return ratioToPercentage(acceptances, Math.max(1, nominations));
    case "participation_density":
      return students > 0 ? normalizeDecimal(participations / students, 2) : 0;
    case "activity_concentration":
      return topActivityShare ?? 0;
    case "representation_balance":
      return 75;
    case "equity_gap":
      return 12;
    case "funnel_success_rate":
      return ratioToPercentage(acceptances, participations);
    case "program_conversion":
      return ratioToPercentage(acceptances, Math.max(1, nominations));
    default:
      return 0;
  }
};

export const metricExportLabel = (id: MetricId, loc: AnalyticsLocale): string =>
  getMetricDefinition(id).exportLabel[loc];

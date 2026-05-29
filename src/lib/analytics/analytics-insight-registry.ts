/**
 * Insight registry — thresholds, priorities, severity, executive phrasing templates.
 */

import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

export type InsightRegistryId =
  | "yearly_participation_spike"
  | "participation_drop_alert"
  | "arabic_section_leads"
  | "mawhiba_medal_majority"
  | "kangaroo_conversion_leader"
  | "medal_density_high"
  | "international_presence_notable"
  | "participation_per_student_high"
  | "grade_band_leads_activity"
  | "girls_medal_conversion_lead"
  | "intl_sat_excellence"
  | "mawhiba_olympiad_majority";

export type InsightSeverity = "info" | "warn" | "critical";

export type InsightRegistryEntry = {
  id: InsightRegistryId;
  priority: number;
  defaultSeverity: InsightSeverity;
  minConfidence: number;
  title: Record<AnalyticsLocale, string>;
  /** Template with {{metric}} placeholders */
  bodyTemplate: Record<AnalyticsLocale, string>;
  metricKeys: string[];
};

export const INSIGHT_REGISTRY: Record<InsightRegistryId, InsightRegistryEntry> = {
  yearly_participation_spike: {
    id: "yearly_participation_spike",
    priority: 80,
    defaultSeverity: "info",
    minConfidence: 0.75,
    title: { ar: "نمو سنوي في المشاركة", en: "Yearly participation growth" },
    bodyTemplate: {
      ar: "المشاركات ارتفعت {{pct}}% مقارنة بالعام السابق ({{prevYear}} → {{lastYear}}).",
      en: "Participations rose {{pct}}% versus the prior year ({{prevYear}} → {{lastYear}}).",
    },
    metricKeys: ["yearTrend"],
  },
  participation_drop_alert: {
    id: "participation_drop_alert",
    priority: 90,
    defaultSeverity: "warn",
    minConfidence: 0.75,
    title: { ar: "تنبيه انخفاض المشاركة", en: "Participation decline alert" },
    bodyTemplate: {
      ar: "المشاركات انخفضت {{pct}}% بين {{prevYear}} و{{lastYear}}.",
      en: "Participations fell {{pct}}% between {{prevYear}} and {{lastYear}}.",
    },
    metricKeys: ["yearTrend"],
  },
  arabic_section_leads: {
    id: "arabic_section_leads",
    priority: 70,
    defaultSeverity: "info",
    minConfidence: 0.7,
    title: { ar: "القسم العربي يقود الكثافة", en: "Arabic section leads density" },
    bodyTemplate: {
      ar: "القسم العربي يمثل {{pct}}% من المشاركات ضمن الفلاتر الحالية.",
      en: "The Arabic section accounts for {{pct}}% of participations under current filters.",
    },
    metricKeys: ["sectionParticipation"],
  },
  mawhiba_medal_majority: {
    id: "mawhiba_medal_majority",
    priority: 75,
    defaultSeverity: "info",
    minConfidence: 0.72,
    title: { ar: "موهبة وتميز ميداليات", en: "Mawhiba medal concentration" },
    bodyTemplate: {
      ar: "طلاب الموهبة يمثلون {{pct}}% من المشاركات ضمن النطاق المفلتر.",
      en: "Mawhiba students represent {{pct}}% of participations in the filtered scope.",
    },
    metricKeys: ["mawhibaSplit"],
  },
  kangaroo_conversion_leader: {
    id: "kangaroo_conversion_leader",
    priority: 65,
    defaultSeverity: "info",
    minConfidence: 0.68,
    title: { ar: "أعلى معدل تحويل", en: "Highest conversion rate" },
    bodyTemplate: {
      ar: "{{activity}} يحقق أعلى معدل تحويل للميداليات ({{rate}}%).",
      en: "{{activity}} achieves the highest medal conversion rate ({{rate}}%).",
    },
    metricKeys: ["medalConversionRate", "topProgram"],
  },
  medal_density_high: {
    id: "medal_density_high",
    priority: 60,
    defaultSeverity: "info",
    minConfidence: 0.65,
    title: { ar: "كثافة ميداليات مرتفعة", en: "High medal density" },
    bodyTemplate: {
      ar: "{{rate}}% من المشاركات حصلت على ميداليات ضمن الفلاتر الحالية.",
      en: "{{rate}}% of participations earned medals under current filters.",
    },
    metricKeys: ["medalConversionRate"],
  },
  international_presence_notable: {
    id: "international_presence_notable",
    priority: 55,
    defaultSeverity: "info",
    minConfidence: 0.6,
    title: { ar: "حضور دولي ملحوظ", en: "Notable international presence" },
    bodyTemplate: {
      ar: "القسم الدولي يمثل {{pct}}% من المشاركات.",
      en: "The international section represents {{pct}}% of participations.",
    },
    metricKeys: ["internationalSectionPct"],
  },
  participation_per_student_high: {
    id: "participation_per_student_high",
    priority: 50,
    defaultSeverity: "info",
    minConfidence: 0.7,
    title: { ar: "كثافة مشاركة فردية", en: "Individual participation density" },
    bodyTemplate: {
      ar: "متوسط {{avg}} مشاركة لكل طالب ({{total}} مشاركة / {{students}} طالب).",
      en: "Average {{avg}} participations per student ({{total}} / {{students}}).",
    },
    metricKeys: ["avgParticipationsPerStudent"],
  },
  grade_band_leads_activity: {
    id: "grade_band_leads_activity",
    priority: 72,
    defaultSeverity: "info",
    minConfidence: 0.68,
    title: { ar: "صف يقود المشاركة", en: "Grade band leads participation" },
    bodyTemplate: {
      ar: "{{grade}} يقود مشاركات {{activity}} ({{count}} مشاركة).",
      en: "{{grade}} leads {{activity}} participations ({{count}} records).",
    },
    metricKeys: ["levelDistribution", "topProgram"],
  },
  girls_medal_conversion_lead: {
    id: "girls_medal_conversion_lead",
    priority: 68,
    defaultSeverity: "info",
    minConfidence: 0.65,
    title: { ar: "البنات وتحويل الميداليات", en: "Girls medal conversion" },
    bodyTemplate: {
      ar: "البنات يحققن معدل تحويل {{rate}}% مقابل {{maleRate}}% للبنين ضمن النطاق المفلتر.",
      en: "Girls achieve {{rate}}% medal conversion vs {{maleRate}}% for boys under filters.",
    },
    metricKeys: ["genderResultStack"],
  },
  intl_sat_excellence: {
    id: "intl_sat_excellence",
    priority: 62,
    defaultSeverity: "info",
    minConfidence: 0.6,
    title: { ar: "القسم الدولي والاختبارات", en: "International & standardized tests" },
    bodyTemplate: {
      ar: "القسم الدولي يمثل {{pct}}% من المشاركات — راقب SAT/IELTS في التحليل المعياري.",
      en: "International section is {{pct}}% of participations — review SAT/IELTS in std. test view.",
    },
    metricKeys: ["internationalSectionPct"],
  },
  mawhiba_olympiad_majority: {
    id: "mawhiba_olympiad_majority",
    priority: 66,
    defaultSeverity: "info",
    minConfidence: 0.64,
    title: { ar: "موهبة والأولمبيادات", en: "Mawhiba & olympiad share" },
    bodyTemplate: {
      ar: "طلاب الموهبة يمثلون {{pct}}% من المشاركات ضمن الأنشطة العلمية/الأولمبيادية.",
      en: "Mawhiba students represent {{pct}}% of participations in science/olympiad-style activities.",
    },
    metricKeys: ["mawhibaSplit"],
  },
};

export const applyInsightTemplate = (
  template: string,
  vars: Record<string, string | number>
): string => {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return out;
};

export const THRESHOLDS = {
  yoySpikePct: 20,
  yoyDropPct: -20,
  sectionLeadPct: 45,
  mawhibaMajorityPct: 55,
  medalConversionHighPct: 30,
  avgParticipationsPerStudentHigh: 1.2,
  intlNotablePct: 25,
} as const;

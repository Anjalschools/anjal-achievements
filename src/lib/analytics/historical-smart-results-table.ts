/**
 * Activity-aware historical results table columns.
 */

import type { HistoricalMetricColumn, HistoricalTableType } from "@/lib/analytics/historical-comparison-table-engine";

export type SmartResultsTableProfile = "competition" | "training" | "testing" | "qualification" | "talent";

export const resolveSmartResultsProfile = (tableType: HistoricalTableType): SmartResultsTableProfile => {
  if (tableType === "medals") return "competition";
  if (tableType === "training_program") return "training";
  if (tableType === "standardized_testing") return "testing";
  if (tableType === "qualification_acceptance") return "qualification";
  return "talent";
};

/** Primary → secondary metric order for competition tables */
const COMPETITION_COLUMNS: HistoricalMetricColumn[] = [
  { key: "participation", labelAr: "المشاركون", labelEn: "Participants", resultToken: "participation" },
  { key: "nomination", labelAr: "المتأهلون", labelEn: "Qualified", resultToken: "nomination" },
  { key: "award_winners", labelAr: "الحاصلون على جوائز", labelEn: "Award winners" },
  { key: "qualification_rate", labelAr: "معدل التأهل", labelEn: "Qualification rate" },
  { key: "award_rate", labelAr: "معدل التتويج", labelEn: "Award rate" },
  { key: "gold", labelAr: "ذهبية", labelEn: "Gold", resultToken: "medal:gold" },
  { key: "silver", labelAr: "فضية", labelEn: "Silver", resultToken: "medal:silver" },
  { key: "bronze", labelAr: "برونزية", labelEn: "Bronze", resultToken: "medal:bronze" },
  { key: "rankings", labelAr: "المراكز", labelEn: "Rankings", resultToken: "rank" },
  { key: "first_place", labelAr: "مركز أول", labelEn: "First place", resultToken: "rank" },
];

const TRAINING_COLUMNS: HistoricalMetricColumn[] = [
  { key: "participation", labelAr: "مسجل", labelEn: "Registered", resultToken: "participation" },
  { key: "nomination", labelAr: "مشارك فعّال", labelEn: "Active", resultToken: "nomination" },
  { key: "intensive", labelAr: "مكتمل", labelEn: "Completed" },
  { key: "acceptance", labelAr: "اجتياز", labelEn: "Pass" },
  { key: "completion_rate", labelAr: "معدل الإكمال", labelEn: "Completion rate" },
];

const TESTING_COLUMNS: HistoricalMetricColumn[] = [
  { key: "participation", labelAr: "مشارك", labelEn: "Participants" },
  { key: "avg_performance", labelAr: "متوسط الأداء", labelEn: "Average score" },
  { key: "score_95", labelAr: "أعلى درجة", labelEn: "Top band" },
  { key: "excellence_rate", labelAr: "نسبة التميز", labelEn: "Excellence rate" },
];

const QUALIFICATION_COLUMNS: HistoricalMetricColumn[] = [
  { key: "participation", labelAr: "مشاركة", labelEn: "Participation", resultToken: "participation" },
  { key: "nomination", labelAr: "ترشيح", labelEn: "Nomination", resultToken: "nomination" },
  { key: "finalists", labelAr: "نهائي", labelEn: "Finalists", resultToken: "nomination" },
  { key: "acceptance", labelAr: "قبول", labelEn: "Acceptance", resultToken: "acceptance" },
  { key: "qualification_rate", labelAr: "معدل التأهل", labelEn: "Qualification rate" },
  { key: "rankings", labelAr: "المراكز", labelEn: "Rankings", resultToken: "rank" },
];

const TALENT_COLUMNS: HistoricalMetricColumn[] = [
  { key: "participation", labelAr: "مشاركة", labelEn: "Participation", resultToken: "participation" },
  { key: "exceptional", labelAr: "موهبة استثنائية", labelEn: "Exceptional" },
  { key: "gifted", labelAr: "موهوب", labelEn: "Gifted" },
  { key: "promising", labelAr: "واعد", labelEn: "Promising" },
  { key: "discovery_rate", labelAr: "نسبة الاكتشاف", labelEn: "Discovery rate" },
];

export const getSmartResultsMetrics = (tableType: HistoricalTableType): HistoricalMetricColumn[] => {
  const profile = resolveSmartResultsProfile(tableType);
  if (profile === "competition") return COMPETITION_COLUMNS;
  if (profile === "training") return TRAINING_COLUMNS;
  if (profile === "testing") return TESTING_COLUMNS;
  if (profile === "qualification") return QUALIFICATION_COLUMNS;
  return TALENT_COLUMNS;
};

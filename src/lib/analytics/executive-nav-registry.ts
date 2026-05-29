/**
 * Stable executive navigator registry — 15 sections, anchor mapping, progress order.
 */

import type { ExecutiveSectionId } from "@/components/analytics/executive/ExecutiveSectionVisibilityStore";

export type ExecutiveNavEntry = {
  execId: ExecutiveSectionId | string;
  anchorId: string;
  titleAr: string;
  titleEn: string;
  order: number;
};

export const EXECUTIVE_NAV_REGISTRY: ExecutiveNavEntry[] = [
  { execId: "exec-kpis", anchorId: "intel-layer-1-kpis", titleAr: "المؤشرات", titleEn: "KPIs", order: 1 },
  { execId: "exec-strategic", anchorId: "exec-strategic-insights", titleAr: "استراتيجي", titleEn: "Strategic", order: 2 },
  { execId: "exec-equity", anchorId: "intel-layer-3-equity", titleAr: "العدالة", titleEn: "Equity", order: 3 },
  { execId: "exec-opportunities", anchorId: "intel-layer-3-opportunity", titleAr: "الفرص", titleEn: "Opportunities", order: 4 },
  { execId: "exec-recommendations", anchorId: "intel-layer-4-recommendations", titleAr: "التوصيات", titleEn: "Recommendations", order: 5 },
  { execId: "exec-students", anchorId: "student-highlights", titleAr: "الطلاب", titleEn: "Students", order: 6 },
  { execId: "exec-competitions", anchorId: "competition-matrix", titleAr: "المسابقات", titleEn: "Competitions", order: 7 },
  { execId: "exec-comparison", anchorId: "intel-layer-5-comparison", titleAr: "المقارنات", titleEn: "Comparisons", order: 8 },
  { execId: "exec-funnels", anchorId: "exec-funnels", titleAr: "مسارات", titleEn: "Funnels", order: 9 },
  { execId: "exec-matrix", anchorId: "demographic-matrix", titleAr: "المصفوفات", titleEn: "Matrix", order: 10 },
  { execId: "exec-demographics", anchorId: "demographics", titleAr: "ديموغرافيا", titleEn: "Demographics", order: 11 },
  { execId: "exec-excellence", anchorId: "exec-excellence", titleAr: "التميز", titleEn: "Excellence", order: 12 },
  { execId: "exec-decisions", anchorId: "exec-decisions", titleAr: "القرارات", titleEn: "Decisions", order: 13 },
  { execId: "exec-historical", anchorId: "exec-historical", titleAr: "تاريخي", titleEn: "Historical", order: 14 },
  { execId: "exec-deep-intelligence", anchorId: "advanced-analytics", titleAr: "ذكاء عميق", titleEn: "Deep intel", order: 15 },
];

export const getVisibleNavEntries = (): ExecutiveNavEntry[] => {
  if (typeof document === "undefined") return EXECUTIVE_NAV_REGISTRY;
  return EXECUTIVE_NAV_REGISTRY.filter((entry) => Boolean(document.getElementById(entry.anchorId)));
};

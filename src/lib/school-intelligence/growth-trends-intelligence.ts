import type {
  DepartmentExcellenceRow,
  GrowthTrendsIntelligence,
  LongitudinalGrowthPoint,
  OpportunityMappingRow,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";
import { confidenceFromEvidenceCount } from "@/lib/school-intelligence/school-intelligence-confidence";

const clampPct = (value: number) => Math.round(value * 10) / 10;

export type GrowthTrendSummaryDiagnostics = {
  pointCount: number;
  participationChangePct: number | null;
  achievementChangePct: number | null;
  fastestCategoryKey: string | null;
  fastestDepartmentKey: string | null;
};

export const buildGrowthTrendsIntelligence = (input: {
  longitudinalGrowth: LongitudinalGrowthPoint[];
  departmentExcellence: DepartmentExcellenceRow[];
  opportunityMapping: OpportunityMappingRow[];
  nodes: StudentSuccessGraphNode[];
}): { trends: GrowthTrendsIntelligence; diagnostics: GrowthTrendSummaryDiagnostics } => {
  const points = input.longitudinalGrowth;
  const first = points[0];
  const last = points[points.length - 1];
  const participationChangePct =
    first && last && first.participations > 0
      ? clampPct(((last.participations - first.participations) / first.participations) * 100)
      : null;

  const avgAchievementFirst = first?.avgSuccessIndex ?? 0;
  const avgAchievementLast = last?.avgSuccessIndex ?? 0;
  const achievementChangePct =
    avgAchievementFirst > 0
      ? clampPct(((avgAchievementLast - avgAchievementFirst) / avgAchievementFirst) * 100)
      : null;

  const fastestDepartment = [...input.departmentExcellence].sort(
    (a, b) => b.growthRatePct - a.growthRatePct
  )[0];
  const fastestOpportunity = [...input.opportunityMapping].sort((a, b) => b.gapPct - a.gapPct)[0];

  const trajectory: GrowthTrendsIntelligence["participationTrajectory"] =
    participationChangePct == null
      ? "stable"
      : participationChangePct >= 5
        ? "rising"
        : participationChangePct <= -5
          ? "declining"
          : "stable";

  const highlights: GrowthTrendsIntelligence["highlights"] = [];

  if (first && last && participationChangePct != null) {
    highlights.push({
      id: "participation-growth",
      titleAr: "نمو المشاركات",
      titleEn: "Participation growth",
      bodyAr: `ارتفعت المشاركات من ${first.participations} إلى ${last.participations} خلال ${points.length > 1 ? `${points.length - 1} فترات` : "الفترة الأخيرة"} (${participationChangePct >= 0 ? "+" : ""}${participationChangePct}%).`,
      bodyEn: `Participations moved from ${first.participations} to ${last.participations} (${participationChangePct >= 0 ? "+" : ""}${participationChangePct}%).`,
      metricKey: "participation",
      changePct: participationChangePct,
      confidence: confidenceFromEvidenceCount(2, points.length, 78),
    });
  }

  if (achievementChangePct != null) {
    highlights.push({
      id: "achievement-growth",
      titleAr: "نمو الإنجاز",
      titleEn: "Achievement growth",
      bodyAr: `متوسط SSI ${avgAchievementFirst} → ${avgAchievementLast} (${achievementChangePct >= 0 ? "+" : ""}${achievementChangePct}%).`,
      bodyEn: `Average SSI ${avgAchievementFirst} → ${avgAchievementLast} (${achievementChangePct >= 0 ? "+" : ""}${achievementChangePct}%).`,
      metricKey: "achievement",
      changePct: achievementChangePct,
      confidence: confidenceFromEvidenceCount(2, input.nodes.length, 74),
    });
  }

  if (fastestDepartment) {
    highlights.push({
      id: `department-${fastestDepartment.key}`,
      titleAr: "أسرع نمو قسم/مسار",
      titleEn: "Fastest growing department/track",
      bodyAr: `${fastestDepartment.labelAr}: نمو ${fastestDepartment.growthRatePct}% مع مؤشر تميز ${fastestDepartment.excellenceIndex}.`,
      bodyEn: `${fastestDepartment.labelEn}: ${fastestDepartment.growthRatePct}% growth, excellence ${fastestDepartment.excellenceIndex}.`,
      metricKey: "department",
      changePct: fastestDepartment.growthRatePct,
      confidence: confidenceFromEvidenceCount(3, fastestDepartment.studentCount, 76),
    });
  }

  if (fastestOpportunity) {
    highlights.push({
      id: fastestOpportunity.key,
      titleAr: "أبرز فرصة للتوسع",
      titleEn: "Top expansion opportunity",
      bodyAr: `${fastestOpportunity.labelAr}: فجوة مشاركة ${fastestOpportunity.gapPct}%.`,
      bodyEn: `${fastestOpportunity.labelEn}: ${fastestOpportunity.gapPct}% participation gap.`,
      metricKey: "opportunity",
      changePct: fastestOpportunity.gapPct,
      confidence: confidenceFromEvidenceCount(2, fastestOpportunity.participantCount, 70),
    });
  }

  const activeStudents = input.nodes.filter((node) => node.participationCount > 0).length;
  const forecastSignalAr =
    trajectory === "rising"
      ? "إشارة إيجابية — استمرار النمو المتوقع مع تعزيز الفرص."
      : trajectory === "declining"
        ? "إشارة تحذيرية — مراجعة برامج المشاركة مطلوبة."
        : "إشارة مستقرة — فرصة لرفع المشاركة ببرامج مستهدفة.";
  const forecastSignalEn =
    trajectory === "rising"
      ? "Positive signal — continued growth expected with opportunity expansion."
      : trajectory === "declining"
        ? "Warning signal — participation programs need review."
        : "Stable signal — targeted programs can lift participation.";

  return {
    trends: {
      highlights: highlights.slice(0, 6),
      participationTrajectory: trajectory,
      forecastSignalAr,
      forecastSignalEn,
      summaryAr:
        participationChangePct != null
          ? `الاتجاه العام: ${trajectory === "rising" ? "صاعد" : trajectory === "declining" ? "متراجع" : "مستقر"} (${participationChangePct >= 0 ? "+" : ""}${participationChangePct}% مشاركات).`
          : "بيانات طولية محدودة — يُفضّل تجميع سنوات إضافية.",
      summaryEn:
        participationChangePct != null
          ? `Overall trend: ${trajectory} (${participationChangePct >= 0 ? "+" : ""}${participationChangePct}% participations).`
          : "Limited longitudinal data — collect additional years for stronger trends.",
    },
    diagnostics: {
      pointCount: points.length,
      participationChangePct,
      achievementChangePct,
      fastestCategoryKey: fastestOpportunity?.key ?? null,
      fastestDepartmentKey: fastestDepartment?.key ?? null,
    },
  };
};

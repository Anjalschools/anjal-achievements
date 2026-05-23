import type { CompetitionDecisionPlatform } from "@/lib/competition-decision-intelligence";
import type { CiObservabilityMeta } from "@/lib/competition-intelligence-debug";

export const FOCUSED_ACHIEVEMENT_OUTCOMES = [
  "all",
  "medal_gold",
  "medal_silver",
  "medal_bronze",
  "rank_first",
  "rank_second",
  "rank_third",
  "nomination",
  "participation",
  "completion",
  "score",
  "recognition",
  "special_award",
] as const;

export type FocusedAchievementOutcome = (typeof FOCUSED_ACHIEVEMENT_OUTCOMES)[number];

export type FocusedActivityParticipantRow = {
  achievementId: string;
  studentNameAr: string;
  studentNameEn: string;
  /** Profile photo URL when linked user has `profilePhoto` */
  studentAvatarUrl?: string;
  gender: string;
  section: string;
  mawhiba: boolean;
  gradeLabelAr: string;
  gradeLabelEn: string;
  stageKey: string;
  stageLabelAr: string;
  stageLabelEn: string;
  schoolOrOrganization: string;
  activityLabelAr: string;
  activityLabelEn: string;
  year: number | null;
  resultLineAr: string;
  resultLineEn: string;
  levelLabelAr: string;
  levelLabelEn: string;
  scoreOrValueDisplay: string;
  scoreNumeric: number | null;
  approvalStatusKey: string;
  approvalLabelAr: string;
  approvalLabelEn: string;
};

/** Shared filter snapshot from server — aligns with ParticipationAnalyticsFilters shape */
export type FocusedReportFiltersSnapshot = Record<string, unknown>;

export type FocusedYearTrendRow = {
  year: number;
  records: number;
  distinctStudents: number;
  goldMedals: number;
  silverMedals: number;
  bronzeMedals: number;
  totalMedals: number;
  excellenceRatePct: number;
  maxLevelRank: number;
  topLevelLabelAr: string;
  topLevelLabelEn: string;
};

export type FocusedExecutiveKpiCard = {
  id: string;
  icon: string;
  tone: "amber" | "slate" | "violet" | "emerald" | "sky";
  labelAr: string;
  labelEn: string;
  value: string;
  hintAr: string;
  hintEn: string;
  trendPct: number | null;
  trendDir: "up" | "down" | "flat";
};

export type FocusedTopPerformerRow = {
  participantId: string;
  nameAr: string;
  nameEn: string;
  recordCount: number;
  medalCount: number;
  maxLevelRank: number;
  school: string;
  stageKey: string;
  stageLabelAr: string;
  stageLabelEn: string;
  avatarUrl: string;
};

export type FocusedExecutiveBundle = {
  kpiCards: FocusedExecutiveKpiCard[];
  yearComparison: FocusedYearTrendRow[];
  demographicStacks: {
    sectionGender: Array<{
      key: string;
      labelAr: string;
      labelEn: string;
      male: number;
      female: number;
    }>;
    stageBreakdown: Array<{ stageKey: string; labelAr: string; labelEn: string; count: number }>;
    mawhibaGender: Array<{
      key: string;
      labelAr: string;
      labelEn: string;
      male: number;
      female: number;
    }>;
  };
  topPerformers: {
    byWeighted: FocusedTopPerformerRow[];
    byParticipation: FocusedTopPerformerRow[];
    byMedals: FocusedTopPerformerRow[];
    byLevel: FocusedTopPerformerRow[];
  };
};

export type FocusedActivityReportPayload = {
  ok: true;
  generatedAt: string;
  filters: FocusedReportFiltersSnapshot;
  focusType: string;
  focusRaw: string;
  activityLabelAr: string;
  activityLabelEn: string;
  focusedOutcome: string;
  ciObservability?: CiObservabilityMeta;
  kpis: {
    totalRecords: number;
    distinctStudents: number;
    approvedRecords: number;
    excellenceRatePct: number;
  };
  charts: {
    resultBars: { key: string; labelAr: string; labelEn: string; count: number; fill: string }[];
    genderPie: { name: string; nameAr: string; nameEn: string; value: number }[];
    sectionPie: { name: string; nameAr: string; nameEn: string; value: number }[];
    mawhibaPie: { name: string; nameAr: string; nameEn: string; value: number }[];
    yearTrend: FocusedYearTrendRow[];
  };
  /** Executive intelligence layer (YoY, demographics, top performers) */
  executive: FocusedExecutiveBundle;
  /** Rule-based narrative, alerts, benchmarking, medal analytics, peer activity ranking */
  decisionPlatform: CompetitionDecisionPlatform;
  participants: FocusedActivityParticipantRow[];
  page: number;
  pageSize: number;
  totalParticipants: number;
};

export type FocusedActivityOptionsPayload = {
  ok: true;
  generatedAt: string;
  filters: FocusedReportFiltersSnapshot;
  ciObservability?: CiObservabilityMeta;
  activityOptions: {
    typeKey: string;
    rawKey: string;
    count: number;
    labelAr: string;
    labelEn: string;
  }[];
};

export type FocusedActivityOptionRow = FocusedActivityOptionsPayload["activityOptions"][number];

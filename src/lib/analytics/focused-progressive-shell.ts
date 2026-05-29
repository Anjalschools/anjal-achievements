import type { CompetitionDecisionPlatform } from "@/lib/competition-decision-intelligence";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";

const EMPTY_DECISION_PLATFORM = {
  narrativeAr: "",
  narrativeEn: "",
  alerts: [],
  recommendations: [],
  medalIntelligence: {
    medalsPer100Records: 0,
    goldPer100Records: 0,
    nominationsPer100Records: 0,
    participationOnlyRatio: 0,
    heatLabelAr: "",
    heatLabelEn: "",
    heatScore: 0,
    bars: [],
  },
  benchmarkIntelligence: {
    sectionWinner: "tie" as const,
    genderWinner: "tie" as const,
    stageWinner: null,
    mawhibaWinner: "tie" as const,
    sectionGapPctPoints: 0,
    genderGapPctPoints: 0,
    mawhibaGapPctPoints: 0,
    rows: [],
  },
  activityRanking: {
    topByExcellence: [],
    topByMedalDensity: [],
    highParticipationLowMedal: [],
    topInternationalShare: [],
    current: { rankExcellence: null, rankMedalDensity: null, rankRecords: null, peerCount: 0 },
  },
} satisfies CompetitionDecisionPlatform;

const EMPTY_CHARTS: FocusedActivityReportPayload["charts"] = {
  resultBars: [],
  genderPie: [],
  sectionPie: [],
  mawhibaPie: [],
  yearTrend: [],
};

const EMPTY_EXECUTIVE: FocusedActivityReportPayload["executive"] = {
  kpiCards: [],
  yearComparison: [],
  demographicStacks: { sectionGender: [], stageBreakdown: [], mawhibaGender: [] },
  topPerformers: { byWeighted: [], byParticipation: [], byMedals: [], byLevel: [] },
};

const EMPTY_KPIS: FocusedActivityReportPayload["kpis"] = {
  totalRecords: 0,
  distinctStudents: 0,
  approvedRecords: 0,
  excellenceRatePct: 0,
};

/** Minimal shell for progressive UI when canonical `focusedData` is not loaded (export-only full fetch). */
export const buildFocusedProgressiveShell = (
  envelope: Partial<FocusedActivityReportPayload> & {
    activityLabelAr: string;
    activityLabelEn: string;
    focusType: string;
    focusRaw: string;
    focusedOutcome: string;
    filters: FocusedActivityReportPayload["filters"];
    generatedAt?: string;
  }
): FocusedActivityReportPayload => ({
  ok: true,
  generatedAt: envelope.generatedAt ?? new Date().toISOString(),
  filters: envelope.filters,
  focusType: envelope.focusType,
  focusRaw: envelope.focusRaw,
  activityLabelAr: envelope.activityLabelAr,
  activityLabelEn: envelope.activityLabelEn,
  focusedOutcome: envelope.focusedOutcome,
  kpis: envelope.kpis ?? EMPTY_KPIS,
  charts: envelope.charts ?? EMPTY_CHARTS,
  executive: envelope.executive ?? EMPTY_EXECUTIVE,
  decisionPlatform: envelope.decisionPlatform ?? EMPTY_DECISION_PLATFORM,
  participants: envelope.participants ?? [],
  page: envelope.page ?? 1,
  pageSize: envelope.pageSize ?? 25,
  totalParticipants: envelope.totalParticipants ?? 0,
});

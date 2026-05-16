import "server-only";
import type { CompetitionSnapshotPayload } from "@/lib/competition/analytics/snapshot-engine";
import { listCompetitionSnapshots } from "@/lib/competition/analytics/historical-metrics";
import { listCompetitionTrendRecords } from "@/lib/competition/analytics/trend-persistence";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";

export type CiBaselineAnomalySeverity = "info" | "warn" | "critical";

export type CiBaselineAnomaly = {
  code: string;
  severity: CiBaselineAnomalySeverity;
  messageAr: string;
  messageEn: string;
  metric: string;
  current: number;
  expectedMin?: number;
  expectedMax?: number;
  baselineAvg?: number;
};

export type CompetitionBaselineReport = {
  ok: true;
  generatedAt: string;
  baseline: {
    avgParticipation: number;
    avgGoldMedals: number;
    avgDistinctStudents: number;
    samplePeriods: number;
  };
  expectedRanges: {
    participation: { min: number; max: number };
    goldMedals: { min: number; max: number };
  };
  anomalies: CiBaselineAnomaly[];
  seasonalComparison: {
    latestYear: number | null;
    previousYear: number | null;
    participationDeltaPct: number | null;
    medalsDeltaPct: number | null;
  };
};

const pctDelta = (cur: number, prev: number): number | null => {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
};

export const buildCompetitionBaselineReport = async (params?: {
  granularity?: CompetitionSnapshotGranularity;
  current?: CompetitionSnapshotPayload | null;
}): Promise<CompetitionBaselineReport> => {
  const granularity = params?.granularity ?? "weekly";
  const snapshots = await listCompetitionSnapshots(granularity, 12);
  const trends = await listCompetitionTrendRecords(8);

  const participationSamples: number[] = [];
  const goldSamples: number[] = [];
  const studentSamples: number[] = [];

  for (const s of snapshots) {
    const p = s.payload as CompetitionSnapshotPayload | undefined;
    if (!p?.participants) continue;
    participationSamples.push(p.participants.totalParticipations);
    studentSamples.push(p.participants.distinctStudents);
    if (p.medals?.gold != null) goldSamples.push(p.medals.gold);
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const avgParticipation = Math.round(avg(participationSamples));
  const avgGoldMedals = Math.round(avg(goldSamples) * 10) / 10;
  const avgDistinctStudents = Math.round(avg(studentSamples));

  const current = params?.current;
  const curParticipation = current?.participants.totalParticipations ?? avgParticipation;
  const curGold = current?.medals.gold ?? avgGoldMedals;

  const expectedRanges = {
    participation: {
      min: Math.round(avgParticipation * 0.7),
      max: Math.round(avgParticipation * 1.35),
    },
    goldMedals: {
      min: Math.round(avgGoldMedals * 0.65),
      max: Math.round(avgGoldMedals * 1.5),
    },
  };

  const anomalies: CiBaselineAnomaly[] = [];

  if (curParticipation < expectedRanges.participation.min) {
    anomalies.push({
      code: "participation_below_baseline",
      severity: curParticipation < expectedRanges.participation.min * 0.85 ? "critical" : "warn",
      messageAr: "المشاركة أقل من المعتاد مقارنة بخط الأساس التاريخي",
      messageEn: "Participation is below the historical baseline",
      metric: "participation",
      current: curParticipation,
      expectedMin: expectedRanges.participation.min,
      expectedMax: expectedRanges.participation.max,
      baselineAvg: avgParticipation,
    });
  }
  if (curParticipation > expectedRanges.participation.max) {
    anomalies.push({
      code: "participation_spike",
      severity: "warn",
      messageAr: "ارتفاع غير معتاد في المشاركة",
      messageEn: "Unusually high participation vs baseline",
      metric: "participation",
      current: curParticipation,
      expectedMin: expectedRanges.participation.min,
      expectedMax: expectedRanges.participation.max,
      baselineAvg: avgParticipation,
    });
  }
  if (curGold < expectedRanges.goldMedals.min) {
    anomalies.push({
      code: "medals_drop",
      severity: "critical",
      messageAr: "انخفاض حاد في الميداليات الذهبية عن المتوقع",
      messageEn: "Sharp drop in gold medals vs baseline",
      metric: "goldMedals",
      current: curGold,
      expectedMin: expectedRanges.goldMedals.min,
      expectedMax: expectedRanges.goldMedals.max,
      baselineAvg: avgGoldMedals,
    });
  }
  if (curGold > expectedRanges.goldMedals.max) {
    anomalies.push({
      code: "medals_spike",
      severity: "warn",
      messageAr: "ارتفاع غير طبيعي في الميداليات",
      messageEn: "Abnormal medal count increase",
      metric: "goldMedals",
      current: curGold,
      expectedMin: expectedRanges.goldMedals.min,
      expectedMax: expectedRanges.goldMedals.max,
      baselineAvg: avgGoldMedals,
    });
  }

  const sortedTrends = [...trends].sort((a, b) => b.academicYear - a.academicYear);
  const latest = sortedTrends[0];
  const previous = sortedTrends[1];
  const participationDeltaPct =
    latest && previous ? pctDelta(latest.records, previous.records) : null;
  const medalsDeltaPct =
    latest && previous ? pctDelta(latest.totalMedals, previous.totalMedals) : null;

  if (participationDeltaPct != null && participationDeltaPct < -25) {
    anomalies.push({
      code: "yoy_participation_decline",
      severity: "warn",
      messageAr: "تراجع سنوي ملحوظ في المشاركة",
      messageEn: "Notable year-over-year participation decline",
      metric: "yoy_participation",
      current: latest?.records ?? 0,
      baselineAvg: previous?.records,
    });
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    baseline: {
      avgParticipation,
      avgGoldMedals,
      avgDistinctStudents,
      samplePeriods: snapshots.length,
    },
    expectedRanges,
    anomalies,
    seasonalComparison: {
      latestYear: latest?.academicYear ?? null,
      previousYear: previous?.academicYear ?? null,
      participationDeltaPct,
      medalsDeltaPct,
    },
  };
};

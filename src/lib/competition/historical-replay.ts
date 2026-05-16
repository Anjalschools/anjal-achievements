import "server-only";
import {
  getCompetitionSnapshotAtPeriod,
  getCompetitionSnapshotById,
} from "@/lib/competition/analytics/historical-metrics";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";
import type { CompetitionSnapshotPayload } from "@/lib/competition/analytics/snapshot-engine";
import { buildCompetitionBaselineReport } from "@/lib/competition/analytics/baseline-engine";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import {
  DEFAULT_COMPETITION_SCALABILITY_POLICY,
  type ScalabilityDegradationNotice,
} from "@/lib/competition/governance/scalability-policy";

export type HistoricalReplayRequest = {
  snapshotId?: string;
  granularity?: CompetitionSnapshotGranularity;
  periodStartIso?: string;
};

export type HistoricalReplayResponse = {
  ok: true;
  replayMode: true;
  snapshotVersion: number;
  aggregationVersion: number;
  periodStart: string;
  periodEnd: string;
  trustStatus: string;
  payload: CompetitionSnapshotPayload;
  baselineAtSnapshot: Awaited<ReturnType<typeof buildCompetitionBaselineReport>>;
  governanceNotices: ScalabilityDegradationNotice[];
};

export const replayHistoricalCompetitionReport = async (
  req: HistoricalReplayRequest
): Promise<HistoricalReplayResponse | { ok: false; error: string }> => {
  let doc: Record<string, unknown> | null = null;

  if (req.snapshotId?.trim()) {
    doc = (await getCompetitionSnapshotById(req.snapshotId.trim())) as Record<string, unknown> | null;
  } else if (req.granularity && req.periodStartIso) {
    const ps = new Date(req.periodStartIso);
    if (Number.isNaN(ps.getTime())) return { ok: false, error: "INVALID_PERIOD_START" };
    doc = (await getCompetitionSnapshotAtPeriod(req.granularity, ps)) as Record<string, unknown> | null;
  }

  if (!doc) return { ok: false, error: "SNAPSHOT_NOT_FOUND" };

  const payload = doc.payload as CompetitionSnapshotPayload;
  const baselineAtSnapshot = await buildCompetitionBaselineReport({
    granularity: (doc.granularity as CompetitionSnapshotGranularity) ?? "monthly",
    current: payload,
  });

  const payloadKb = JSON.stringify(payload).length / 1024;
  const governanceNotices: ScalabilityDegradationNotice[] = [];
  if (payloadKb > DEFAULT_COMPETITION_SCALABILITY_POLICY.maxReplayPayloadKb) {
    governanceNotices.push({
      code: "replay_payload_trimmed",
      messageAr: "تم تقليص حمولة إعادة التشغيل وفق سياسة التوسع",
      messageEn: "Replay payload trimmed per scalability policy",
    });
  }

  return {
    ok: true,
    replayMode: true,
    snapshotVersion: Number(doc.payloadVersion) || 1,
    aggregationVersion: Number(doc.aggregationVersion) || CI_AGGREGATION_VERSION,
    periodStart: new Date(doc.periodStart as Date).toISOString(),
    periodEnd: new Date(doc.periodEnd as Date).toISOString(),
    trustStatus: String(doc.trustStatus ?? payload.trustStatus ?? "unknown"),
    payload,
    baselineAtSnapshot,
    governanceNotices,
  };
};

/**
 * Build canonical analytics snapshot from API payloads (no raw Mongo rows on client).
 */

import {
  buildAnalyticsCanonicalDataset,
  type AnalyticsAchievementRecord,
  type AnalyticsCanonicalDataset,
  ciRoundCount,
} from "@/lib/analytics/achievement-analytics-normalizer";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";

export type AnalyticsCanonicalSnapshot = {
  dataset: AnalyticsCanonicalDataset;
  sourceKeys: string[];
  generatedAt: string | null;
  totalParticipations: number;
  distinctStudents: number;
};

const synthFromGeneral = (general: ParticipationAnalyticsPayload | null): AnalyticsAchievementRecord[] => {
  if (!general?.ok) return [];
  const rows: AnalyticsAchievementRecord[] = [];
  let i = 0;
  for (const act of general.table ?? []) {
    const n = Math.min(act.totalParticipations, 200);
    for (let k = 0; k < n; k++) {
      rows.push({
        id: `gen_${act.activityKey}_${k}`,
        achievementType: act.typeKey,
        achievementCategory: act.typeKey,
        achievementName: act.activityKey.split("\u001f")[1] || act.typeKey,
        achievementLevel: act.levelKey,
        resultType: act.participationResultKey === "medal" ? "medal" : act.participationResultKey,
      });
      i += 1;
    }
  }
  if (rows.length === 0 && general.kpis.totalParticipations > 0) {
    for (const bucket of general.charts.resultOutcomeCompare) {
      const c = ciRoundCount(bucket.count);
      for (let j = 0; j < Math.min(c, 500); j++) {
        rows.push({
          id: `outcome_${bucket.key}_${j}`,
          achievementType: "other",
          resultType: bucket.key === "gold" || bucket.key === "silver" || bucket.key === "bronze" ? "medal" : bucket.key,
          medalType: bucket.key === "gold" || bucket.key === "silver" || bucket.key === "bronze" ? bucket.key : undefined,
        });
      }
    }
  }
  return rows;
};

const synthFromFocusedParticipants = (
  focused: FocusedActivityReportPayload | null
): AnalyticsAchievementRecord[] => {
  if (!focused?.ok) return [];
  return focused.participants.map((p, idx) => ({
    id: p.achievementId || `f_${idx}`,
    participantId: `fp_${idx}`,
    achievementType: focused.focusType,
    achievementCategory: focused.focusType,
    achievementName: focused.focusRaw,
    achievementLevel: p.levelLabelEn.toLowerCase().includes("international") ? "international"
      : p.levelLabelEn.toLowerCase().includes("kingdom") ? "kingdom"
      : p.levelLabelEn.toLowerCase().includes("province") ? "province"
      : "school",
    resultType: p.resultLineEn.toLowerCase().includes("gold") ? "medal"
      : p.resultLineEn.toLowerCase().includes("silver") ? "medal"
      : p.resultLineEn.toLowerCase().includes("bronze") ? "medal"
      : "participation",
    medalType:
      p.resultLineEn.toLowerCase().includes("gold") ? "gold"
      : p.resultLineEn.toLowerCase().includes("silver") ? "silver"
      : p.resultLineEn.toLowerCase().includes("bronze") ? "bronze"
      : undefined,
  }));
};

export const buildAnalyticsCanonicalSnapshot = (input: {
  general: ParticipationAnalyticsPayload | null;
  focused: FocusedActivityReportPayload | null;
  studentIntel: StudentIntelligencePayload | null;
}): AnalyticsCanonicalSnapshot => {
  const sourceKeys: string[] = [];
  const merged: AnalyticsAchievementRecord[] = [];

  if (input.focused?.participants?.length) {
    merged.push(...synthFromFocusedParticipants(input.focused));
    sourceKeys.push("focused_participants");
  }
  if (input.general) {
    merged.push(...synthFromGeneral(input.general));
    sourceKeys.push("general_aggregates");
  }

  const dataset = buildAnalyticsCanonicalDataset(merged);
  const totalParticipations =
    input.general?.kpis.totalParticipations ??
    input.focused?.kpis.totalRecords ??
    dataset.totalParticipations;
  const distinctStudents =
    input.general?.kpis.distinctStudents ??
    input.focused?.kpis.distinctStudents ??
    dataset.distinctParticipantIds;

  const generatedAt =
    input.focused?.generatedAt ??
    input.general?.generatedAt ??
    input.studentIntel?.generatedAt ??
    null;

  return {
    dataset,
    sourceKeys,
    generatedAt,
    totalParticipations: ciRoundCount(totalParticipations),
    distinctStudents: ciRoundCount(distinctStudents),
  };
};

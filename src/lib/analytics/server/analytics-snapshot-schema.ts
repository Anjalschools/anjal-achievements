/**
 * Executive analytics snapshot payload schema (persisted, API-safe JSON).
 */

import type { AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import type { AnalyticsNarrativeBundle, ExecutiveNarrative } from "@/lib/analytics/analytics-narrative-engine";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";

export const EXECUTIVE_SNAPSHOT_PAYLOAD_VERSION = 1;

export type ExecutiveSnapshotKpiStrip = {
  totalParticipations: number;
  uniqueStudents: number;
  goldMedalCount: number;
  medalConversionPct: number;
  internationalSectionPct: number;
  femalePct: number;
};

export type ExecutiveSnapshotStudentIntelLite = {
  byWeightedScore: StudentIntelRow[];
  byMedals: StudentIntelRow[];
  byFastestGrowth: StudentIntelRow[];
};

export type ExecutiveAnalyticsSnapshotPayload = {
  version: number;
  aggregationVersion: number;
  computedAt: string;
  filterFingerprint: string;
  kpiStrip: ExecutiveSnapshotKpiStrip;
  narrativeBundle: AnalyticsNarrativeBundle;
  strategicInsights: ExecutiveSemanticInsight[];
  insights: AnalyticsInsightsBundle;
  studentIntelLite: ExecutiveSnapshotStudentIntelLite;
  narratives: ExecutiveNarrative[];
  trustIssues: string[];
  /** Precomputed AI executive decisions (Phase 10) */
  aiDecisionBundle?: AiDecisionEngineResult;
};

export type ExecutiveSnapshotResolveMeta = {
  source: "snapshot" | "live" | "snapshot_stale";
  filterFingerprint: string;
  snapshotId?: string;
  ageMs: number;
  facetMs: number;
  trustStatus: string;
};

export type ExecutiveSnapshotBundleResponse = {
  ok: true;
  bundle: ExecutiveAnalyticsSnapshotPayload;
  meta: ExecutiveSnapshotResolveMeta;
};
